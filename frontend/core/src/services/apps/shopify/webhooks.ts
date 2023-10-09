import { Api, apiRequest } from '../../../helpers/api'
import { Wehbook } from '@/index'

type T = Wehbook
export const SHOPIFY_WEBHOOKS_ENDPOINT = '/apps/shopify/webhooks'

export class ShopifyWebhooksService extends Api<T> {
	async registerAllOrdersWebhooks(installed_app_id: number): Promise<T[]> {
		return await apiRequest<T[]>({
			url: `${SHOPIFY_WEBHOOKS_ENDPOINT}/register/orders/all?installed_app_id=${installed_app_id}`,
			method: 'GET'
		})
	}
}
