import { AppStoreIntegrationName, InstalledAppsService, AppIntegrationStatus } from '@juicyllama/app-store'
import { CronRunner } from '@juicyllama/core'
import { Logger, Modules, Dates } from '@juicyllama/utils'
import { Injectable, forwardRef, Inject } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { LessThan, IsNull, In } from 'typeorm'
import { CRON_ECOMMERCE_TRANSACTIONS_SYNC_DOMAIN } from './transactions.constants'
import { StoresService } from '../../stores/stores.service'
import { LazyModuleLoader } from '@nestjs/core'
import { TransactionsShopifyMapperService } from './mappers/shopify/transactions.service'

@Injectable()
export class TransactionsCronSyncService {
	constructor(
		@Inject(forwardRef(() => Logger)) private readonly logger: Logger,
		@Inject(forwardRef(() => InstalledAppsService)) private readonly installedAppsService: InstalledAppsService,
		@Inject(forwardRef(() => StoresService)) private readonly storesService: StoresService,
		readonly lazyModuleLoader: LazyModuleLoader,
		@Inject(forwardRef(() => TransactionsShopifyMapperService))
		private readonly transactionsShopifyMapperService: TransactionsShopifyMapperService,
	) {}

	@Cron(process.env.CRON_ECOMMERCE_TRANSACTIONS_SYNC_FREQUENCY ?? CronExpression.EVERY_10_MINUTES, {
		disabled: !process.env.CRON_ECOMMERCE_TRANSACTIONS_SYNC,
	})
	async cronSyncTransactions() {
		return await CronRunner(CRON_ECOMMERCE_TRANSACTIONS_SYNC_DOMAIN, this.syncTransactions())
	}

	async syncTransactions(): Promise<any> {
		const domain = CRON_ECOMMERCE_TRANSACTIONS_SYNC_DOMAIN

		const installed_apps = await this.installedAppsService.findAll({
			where: [
				{
					app: {
						integration_name: In([AppStoreIntegrationName.shopify]),
					},
					integration_status: AppIntegrationStatus.CONNECTED,
					active: true,
					next_check_at: LessThan(new Date()),
				},
				{
					app: {
						integration_name: In([AppStoreIntegrationName.shopify]),
					},
					integration_status: AppIntegrationStatus.CONNECTED,
					active: true,
					next_check_at: IsNull(),
				},
			],
			order: {
				next_check_at: 'ASC',
			},
		})

		this.logger.log(`[${domain}] ${installed_apps.length} Apps Need Syncing`)

		const results = {
			total: 0,
			processed: 0,
			orders: 0,
			success: 0,
			errored: 0,
			errors: <any>[],
		}

		results.total = installed_apps.length

		for (const installed_app of installed_apps) {
			try {
				this.logger.debug(
					`[${domain}][Installed App #${installed_app.installed_app_id}] Syncing Orders`,
					installed_app,
				)

				const store = await this.storesService.findOne({
					where: { installed_app_id: installed_app.installed_app_id },
				})

				this.logger.debug(
					`[${domain}][Installed App #${installed_app.installed_app_id}][Store #${store?.store_id}]`,
					{
						installed_app: installed_app,
						store: store,
					},
				)

				if (!store) {
					this.logger.error(`[${domain}] Store not found`, {
						installed_app_id: installed_app.installed_app_id,
					})
					results.errored++
					results.errors.push(
						new Error(`Store not found for installed app ${installed_app.installed_app_id}`),
					)
					continue
				}

				switch (installed_app.app?.integration_name) {
					case AppStoreIntegrationName.shopify:
						if (!Modules.shopify.isInstalled) {
							this.logger.error(`[${domain}] Shopify module not installed`)
							results.errored++
							results.errors.push(new Error(`Shopify module not installed`))
							continue
						}

						this.logger.debug(
							`[${domain}][Installed App #${installed_app.installed_app_id}][Store #${store?.store_id}] Shopify store: ${installed_app.settings.SHOPIFY_SHOP_NAME}`,
						)

						const { ShopifyOrdersModule, ShopifyOrdersService } = await Modules.shopify.load()

						const shopifyOrdersModule = await this.lazyModuleLoader.load(() => ShopifyOrdersModule)

						const shopifyOrdersService = shopifyOrdersModule.get(ShopifyOrdersService)

						if (!installed_app.last_check_at) {
							installed_app.last_check_at = Dates.daysAgo(90)
						}

						const options = {
							api_version: '2024-01',
							status: 'any',
							updated_at_min: installed_app.last_check_at.toISOString(),
						}

						this.logger.debug(
							`[${domain}][Installed App #${installed_app.installed_app_id}][Store #${store?.store_id}] Get orders`,
							options,
						)

						const orders = await shopifyOrdersService.listOrders(installed_app, options)

						for (const order of orders) {
							await this.transactionsShopifyMapperService.pushTransaction(order, store, installed_app)
						}

						results.orders += orders.length

						this.logger.debug(
							`[${domain}] ${orders.length} Orders synced for store: ${installed_app.settings.SHOPIFY_SHOP_NAME}`,
							{
								installed_app_id: installed_app.installed_app_id,
								account_id: installed_app.account_id,
							},
						)
						break
					default:
						this.logger.error(`[${domain}] Integration not supported`, {
							installed_app_id: installed_app.installed_app_id,
							integration_name: installed_app.app?.integration_name,
						})
						results.errored++
						results.errors.push(new Error(`Integration not supported`))
						continue
				}

				const updateRunTimes = {
					installed_app_id: installed_app.installed_app_id,
					last_check_at: new Date(),
					next_check_at: Dates.addMinutes(new Date(), 10),
				}

				await this.installedAppsService.update(updateRunTimes)
				this.logger.log(`[${domain}] Installed App Runtimes Updated`, updateRunTimes)
				results.success++
			} catch (err: any) {
				this.logger.error(
					`[${domain}][InstalledApp #${installed_app.installed_app_id}] Error syncing orders`,
					err,
				)
				results.errored++
				results.errors.push(err)
			}

			results.processed++
		}

		return results
	}
}
