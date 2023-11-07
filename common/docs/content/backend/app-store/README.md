# Getting Started

The app store module allows you to give your users the ability to add app integrations into their projects.

For example, connect their WordPress site to your project and perform actions on their behalf.

## Install

Follow these instructions to use the app store in your project.

### Package

Install the package into your project:

```bash
pnpm install @juicyllama/app-store
```

### Api Backend

Import the module into your application:

```typescript
//app.module.ts
import { AppsModule } from '@juicyllama/app-store'

@Module({
	imports: [
		forwardRef(() => AppsModule),
	],
})
```

Add the documentation helper into your swagger config

```typescript
//main.ts
import { installAppStoreDocs } from '@juicyllama/app-store'

//place this below the swagger setup
redoc = installAppStoreDocs(redoc)
```

### Types of apps

The system supports two different types of apps:

|---------|-----------------------------------|
| Type    | Description |
|---------|-----------------------------------|
| CREDENTIALS  | Pass any API keys etc via the app settings or .env |
| OAUTH2 | Follows the Oauth flow |
|---------|-----------------------------------|


#### Credentials

When an app is setup as credentials it will check the following to try and find the connection settings:

- Inside the `settings` of the `installed_app`
- Inside the `.env` file

This allows both user defined and system defined apps.

#### Oauth

To provide the easiest implementation of Oauth2 possible, we have tried to abstract this process where possible.

Follow our Oauth2 process flow here to learn more about how you can install apps via Oauth and also how to build Oauth integration into our app ecosystem.

### Supported Apps

We currently support the following apps in the app store

|---------|-----------------------------------|
| App    | Connection Types |
|---------|-----------------------------------|
| [Shopify](/apps/shopify/)  | `OAUTH2` |
| [WordPress](/apps/wordpress) | `CREDENTIALS` |
|---------|-----------------------------------|

### Parent / Child Apps

Some apps are "whitelabel" or "saas" apps in which other brands use. 

For exmaple, Everflow allows brands to whitelabel their app. This means many apps can be added by use the Everflow integration.

For this we introduced Parent/Child apps, this is a way of you specifing in a App the parent app_id. The system will then revert back to the parent app for integration.