import { Logger } from '@juicyllama/utils'
import { UseGuards, Inject, OnApplicationShutdown } from '@nestjs/common'
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import { WebsocketJwtAuthGuard } from './ws-auth/websocket.jwt-auth.guard'
import { WebsocketJwtAuthMiddleware } from './ws-auth/websocket.jwt-auth.middleware'
import { WebsocketService } from './websocket.service'
import Redis from 'ioredis'
import { REDIS_SUB_CLIENT, WEBSOCKETS_REDIS_CHANNEL, WebsocketRedisEvent } from './websocket.constants'

@UseGuards(WebsocketJwtAuthGuard)
@WebSocketGateway({ cors: true })
export class WebsocketGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
	private connectedUserSockets: Map<number, string> = new Map() // user_id -> socket_id
	//@ts-ignore
	@WebSocketServer() server: Server

	constructor(
		private readonly logger: Logger,
		private websocketService: WebsocketService,
		@Inject(REDIS_SUB_CLIENT) private readonly redisSubClient: Redis,
	) {}

	async afterInit(server: Server) {
		server.use(WebsocketJwtAuthMiddleware() as any)
		if (this.server) {
			this.logger.debug('Websocket server initialized')
		} else {
			throw new Error('Websocket server not initialized')
		}
		await this.subscribeToEvents()
	}

	onApplicationShutdown() {
		this.redisSubClient.disconnect()
	}

	private async subscribeToEvents() {
		await this.redisSubClient.subscribe(WEBSOCKETS_REDIS_CHANNEL, (err, count) => {
			if (err) {
				// Handle error
				this.logger.error('Failed to subscribe: %s', err.message)
			} else {
				this.logger.debug(`Subscribed successfully! This client is currently subscribed to ${count} channels.`)
			}
		})

		this.redisSubClient.on('message', (channel, message) => {
			this.logger.debug(`Received message from ${channel}: ${message}`)
			// Handle your message here
			const json = JSON.parse(message) as WebsocketRedisEvent
			this.emitToSockets(json)
		})
	}

	public emitToSockets(msg: WebsocketRedisEvent) {
		if (!this.server) throw new Error('Server not initialized')
		if (msg.userId) {
			const socketId = this.connectedUserSockets.get(msg.userId)
			if (socketId) {
				this.logger.debug(`Emitting to user ${msg.userId} with socketId ${socketId}`)
				this.server.to(socketId).emit(msg.event, msg.data)
			} else {
				this.logger.debug(
					`User ${msg.userId} not connected. connectedUserSockets: ${Object.keys(this.connectedUserSockets)}`,
				)
			}
			return
		} else {
			this.server.emit(msg.event, msg.data)
		}
	}

	private setUser(userId: number, socketId: string) {
		this.connectedUserSockets.set(userId, socketId)
		this.logger.debug(`User ${userId} connected with socketId ${socketId}`)
	}

	private removeUser(userId: number) {
		this.connectedUserSockets.delete(userId)
		this.logger.debug(`User ${userId} disconnected`)
	}

	handleConnection(client: any, ...args: any[]) {
		this.setUser(client.user.user_id, client.id)
		this.logger.debug(
			`Client id: ${client.id} connected. user_id=${client.user.user_id}. Number of connected clients: ${this.server.sockets.sockets.size}`,
		)
	}

	handleDisconnect(client: any) {
		this.removeUser(client.user.user_id)
		this.logger.debug(
			`Cliend id:${client.id} disconnected. user_id=${client.user.user_id}. Number of connected clients: ${this.server.sockets.sockets.size}`,
		)
	}

	@SubscribeMessage('message')
	handleMessage(client: any, payload: any): string {
		this.logger.log('handleMessage', payload)
		return 'Hello world!'
	}
}
