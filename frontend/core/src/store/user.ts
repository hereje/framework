import { Json } from '@juicyllama/vue-utils'
import { defineStore } from 'pinia'
import { QVueGlobals } from 'quasar'
import { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { goToLogin, logger } from '../helpers'
import {
	accountAuthCheck,
	getUser as loadUserFromApi,
	loginUser,
	logoutUser,
	passwordlessLogin,
	passwordlessLoginCode,
	resetPassword,
	resetPasswordCode,
	resetPasswordComplete,
} from '../services/auth'
import { USERS_ENDPOINT, UsersService } from '../services/users'
import type { User, UserLogin } from '../types'
import { LogSeverity, UserPreferences } from '../types'
import { AccountStore } from './account'
import { closeWebsocket, openWebsocket } from '../services/websockets'

type T = User

const usersService = new UsersService()

export const UserStore = defineStore('user', {
	state: () => ({
		user: Json.getLocalStorageObject<User>('user'),
		preferences: Json.getLocalStorageObject<UserPreferences>('user_preferences'),
		preLoginRedirect: Json.getLocalStorageObject<string>('preLoginRedirect'),
	}),
	actions: {
		async setUser(user: T): Promise<T> {
			window.localStorage.setItem('user', JSON.stringify(user))
			this.$state.user = user
			return user
		},

		setPreference(object: Partial<UserPreferences>): UserPreferences {
			const merged: UserPreferences = {
				...this.$state.preferences,
				...object,
			}

			window.localStorage.setItem('user_preferences', JSON.stringify(merged))
			this.$state.preferences = merged
			return merged
		},

		async setPreLoginRedirect(redirect: string): Promise<string> {
			window.localStorage.setItem('preLoginRedirect', redirect)
			this.$state.preLoginRedirect = redirect
			return redirect
		},

		async deletePreLoginRedirect(): Promise<void> {
			window.localStorage.removeItem('preLoginRedirect')
			this.$state.preLoginRedirect = null
		},

		async login(data: UserLogin, q?: QVueGlobals, router?: Router): Promise<User> {
			try {
				const success = await loginUser(data, q, router)
				if (!success) return
				return await this.loadUserAndAccount(q)
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message, q: q })
			}
		},

		async passwordlss(email: string): Promise<boolean> {
			try {
				await passwordlessLogin(email)
				return true
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message })
				return false
			}
		},

		async passwordlssCode(email: string, code: string, q?: QVueGlobals): Promise<T> {
			try {
				await passwordlessLoginCode(email, code)
				return await this.loadUserAndAccount(q)
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message })
			}
		},

		async reset(email: string, q?: QVueGlobals): Promise<boolean> {
			try {
				await resetPassword(email)
				return true
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message, q: q })
				return false
			}
		},

		async resetCode(email: string, code: string): Promise<boolean> {
			try {
				await resetPasswordCode(email, code)
				return true
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message })
				return false
			}
		},

		async resetComplete(email: string, code: string, password: string, q?: QVueGlobals): Promise<T> {
			await resetPasswordComplete(email, code, password)
			return await this.loadUserAndAccount(q)
		},

		async getUserAsync(): Promise<T> {
			const userData = await loadUserFromApi()
			return await this.setUser(userData)
		},

		isAdmin(router: Router, route: RouteLocationNormalizedLoaded, account_id?: number): boolean {
			if (!account_id) {
				const accountStore = AccountStore()
				account_id = accountStore.getAccountId
			}

			if (!this.$state.user) {
				if (route.fullPath) {
					router.push(`/login?r=${route.fullPath}`)
				} else {
					this.logout(router, '/login')
				}
				return false
			}

			const user_accounts = this.$state.user.user_accounts

			if (!user_accounts) {
				this.logout(router, '/login')
				return false
			}

			const user_account = user_accounts.find(user_account => {
				if (user_account.account_id === account_id) return user_account
			})

			return ['ADMIN', 'OWNER'].includes(user_account.role)
		},

		async updateOwnProfile(data: Partial<User>, q?: QVueGlobals): Promise<T> {
			try {
				const user = await usersService.update({
					url: USERS_ENDPOINT,
					record_id: this.$state.user.user_id,
					data: data,
				})
				if (user.user_id) {
					logger({ severity: LogSeverity.LOG, message: 'Profile updated successfully', q: q })
					await this.setUser(user)
					return user
				}
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message })
			}
		},

		async updateOwnAvatar(file: any, q?: QVueGlobals): Promise<T> {
			try {
				const user = await usersService.updateUserAvatar(this.$state.user.user_id, file)
				if (user?.avatar_image_url) {
					logger({ severity: LogSeverity.LOG, message: 'Avatar updated successfully', q: q })
					await this.setUser({
						...this.$state.user,
						avatar_image_url: user.avatar_image_url,
						avatar_type: user.avatar_type,
					})
					return user
				}
			} catch (e: any) {
				logger({ severity: LogSeverity.ERROR, message: e.message })
			}
		},

		async logout(router?: Router, redirect?: string) {
			closeWebsocket()
			logger({ severity: LogSeverity.VERBOSE, message: `[Store][User][Logout] Logout User` })
			window.localStorage.clear()
			await logoutUser()
			this.$state.user = null
			if (!router) {
				if (redirect) {
					window.location.href = redirect
				} else {
					window.location.href = '/'
				}
			}

			await goToLogin(router, redirect)
		},

		async loadUserAndAccount(q?: QVueGlobals): Promise<T> {
			const user = await loadUserFromApi()

			if (!user?.user_id) {
				logger({ severity: LogSeverity.ERROR, message: `Authentication Error`, q: q })
				return
			}

			logger({ severity: LogSeverity.VERBOSE, message: `User logged in, setting account` })

			const accountStore = AccountStore()

			if (!accountStore.getAccountId) {
				await accountStore.setAccountByUser(user)
			}

			if (!user.accounts.map(accounts => accounts.account_id).includes(accountStore.getAccountId)) {
				await accountStore.setAccountByUser(user)
			}

			logger({ severity: LogSeverity.LOG, message: `Login Successful`, q: q })

			await this.setUser(user)

			await openWebsocket()

			return user
		},

		async accountCheck(router: Router, redirect: string) {
			if (!accountAuthCheck) {
				logger({ severity: LogSeverity.VERBOSE, message: `[Store][User][AccountCheck] Failed` })
				await this.logout(router, redirect)
			}
		},
	},
	getters: {
		getUser(state): User {
			return state.user ?? null
		},
		getUserId(state): number {
			return state.user?.user_id ?? null
		},
		getEmail(state): string {
			return state.user?.email ?? null
		},
		getPreLoginRedirect(state): string {
			return state.preLoginRedirect ?? null
		},
	},
})
