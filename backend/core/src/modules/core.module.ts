import { Module, forwardRef } from '@nestjs/common'
import { AccountModule } from './accounts/account.module'
import { AuthModule } from './auth/auth.module'
import { BeaconModule } from './beacon/beacon.module'
import { ConfigValidationModule } from './config/config.module'
import { FxModule } from './fx/fx.module'
import { SettingsModule } from './settings/settings.module'
import { StorageModule } from './storage/storage.module'
import { TagsModule } from './tags/tags.module'
import { UsersModule } from './users/users.module'
import { WebsocketModule } from './websocket/websocket.module'
@Module({
	imports: [
		forwardRef(() => WebsocketModule),
		forwardRef(() => AccountModule),
		forwardRef(() => AuthModule),
		forwardRef(() => BeaconModule),
		forwardRef(() => ConfigValidationModule),
		forwardRef(() => FxModule),
		forwardRef(() => SettingsModule),
		forwardRef(() => StorageModule),
		forwardRef(() => TagsModule),
		forwardRef(() => UsersModule),
	],
	controllers: [],
	providers: [],
})
export class CoreModule {}
