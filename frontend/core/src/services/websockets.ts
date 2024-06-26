import { io, Socket } from 'socket.io-client'
import { logger } from '../helpers'
import { LogSeverity } from '../types'
import { refreshToken } from './auth'
import instance from '.'
import _ from 'lodash'

let socket: Socket | null = null
let connectionPromise: Promise<Socket> | null

export async function openWebsocket() {
	if (socket) {
		logger({ severity: LogSeverity.WARN, message: `[Websocket] Already open` })
		return
	}
	if (connectionPromise) {
		logger({ severity: LogSeverity.WARN, message: `[Websocket] Already connecting` })
		return
	}
	const baseURL = instance.defaults.baseURL
	const accessToken = await refreshToken() // Refresh the token
	if (_.isString(baseURL) && _.isString(accessToken)) {
		try {
			const _socket: Socket = io(baseURL, {
				extraHeaders: {
					Authorization: `Bearer ${accessToken}`,
				},
				reconnection: true,
				reconnectionDelay: 10, // start fast because it might be a temporary network issue or a need to refresh the token
				reconnectionDelayMax: 5000, // gradually increase the delay to avoid flooding the server
				reconnectionAttempts: Infinity, // keep trying to reconnect forever. user might have logged out and logged back in again
			})
			connectionPromise = new Promise<Socket>(resolve => {
				_socket.on('connect', () => {
					logger({ severity: LogSeverity.VERBOSE, message: `[Websocket] Connected` })
					_socket.onAny((event, data) =>
						logger({
							severity: LogSeverity.VERBOSE,
							message: `[Websocket] Incoming message "${event}"`,
							object: data,
						}),
					)
					socket = _socket
					resolve(_socket)
				})
				_socket.on('connect_error', error => {
					logger({
						severity: error.message === 'Token expired' ? LogSeverity.VERBOSE : LogSeverity.ERROR,
						message: `[Websocket] Connection error. msg=${error.message}`,
						object: error,
					})
					refreshToken().then(newToken => {
						logger({
							severity: LogSeverity.VERBOSE,
							message: `[Websocket] Reconnecting with new token`,
							object: error,
						})
						_socket.io.opts.extraHeaders.Authorization = `Bearer ${newToken}`
						_socket.connect() // Reconnect with new token
					})
				})
			})
			await connectionPromise
		} catch (error) {
			logger({ severity: LogSeverity.ERROR, message: `[Websocket] Failed to connect`, object: error })
			throw error
		}
	} else {
		logger({
			severity: LogSeverity.WARN,
			message: `[Websocket] Failed to obtain baseURL or access token`,
			object: { baseURL, accessToken: (accessToken || 'undefined').substring(0, 10) },
		})
		throw new Error('Failed to obtain access token')
	}
}

export function closeWebsocket() {
	if (socket) {
		socket.close()
		socket = null
		connectionPromise = null
		logger({ severity: LogSeverity.WARN, message: `[Websocket] Disconnected` })
	}
}

export async function subscribeWebsocket(event: string, listener: (data: any) => void): Promise<void> {
	if (!connectionPromise) {
		await openWebsocket()
	}
	if (!socket) {
		logger({
			severity: LogSeverity.VERBOSE,
			message: `[Websocket] Waiting for connection`,
		})
	}
	const _socket = await connectionPromise
	_socket.on(event, listener)
	logger({ severity: LogSeverity.VERBOSE, message: `[Websocket] Listening for events: ${event}` })
}

export async function unsubscribeWebsocket(event: string, listener?: (data: any) => void): Promise<void> {
	if (!socket) {
		logger({ severity: LogSeverity.ERROR, message: `[Websocket] Not open` })
		return
	}
	socket.off(event, listener)
	logger({ severity: LogSeverity.VERBOSE, message: `[Websocket] Unbind for events: ${event}` })
}
