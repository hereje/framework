import {App} from "./apps";

export interface JL {
	project_name: string,
	apps: App[],
	project_id?: number,
	github_project_board_id?: number,
	docker?: boolean,
	doppler?: boolean,
}