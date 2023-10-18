import { ChartsPeriod, ChartsResponseDto, StatsMethods, StatsResponseDto, Csv, Arrays } from '@juicyllama/utils'
import { Query as TQuery } from '../utils/typeorm/Query'
import { TypeOrm } from '../utils/typeorm/TypeOrm'
import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import _ from 'lodash'
import { DeepPartial, DeleteResult, InsertResult } from 'typeorm'
import { UploadType, ImportMode } from '../types/common'

export async function crudCreate<T>(options: { service: any; data: any; account_id?: number }): Promise<T> {
	return await options.service.create({
		...options.data,
		account_id: options.account_id ?? options.data.account_id ?? null,
	})
}

export async function crudFindAll<T>(options: {
	service: any
	tQuery: TQuery<T>
	account_id?: number
	query: any
	searchFields?: string[]
	order_by?: string
}): Promise<T[]> {
	const where = options.tQuery.buildWhere({
		repository: options.service.repository,
		query: options.query,
		account_id: options.account_id ?? null,
		search_fields: options.searchFields,
	})

	const sql_options = TypeOrm.findOptions<T>(options.query, where, options.order_by)
	return await options.service.findAll(sql_options)
}

export async function crudFindOne<T>(options: {
	service: any
	query: any
	primaryKey: number
	account_id?: number
}): Promise<T> {
	const PRIMARY_KEY = TypeOrm.getPrimaryKey<T>(options.service.repository)

	const where = {
		[PRIMARY_KEY]: options.primaryKey,
		...(options.account_id ? { account: { account_id: options.account_id } } : null),
	}

	//@ts-ignore
	const sql_options = TypeOrm.findOneOptions<T>(options.query, where)
	return await options.service.findOne(sql_options)
}

export async function crudStats<T>(options: {
	service: any
	tQuery: TQuery<T>
	account_id?: number
	query: any
	method?: StatsMethods
	searchFields: string[]
}): Promise<StatsResponseDto> {
	if (!options.method) {
		options.method = StatsMethods.COUNT
	}

	const where = options.tQuery.buildWhere({
		repository: options.service.repository,
		query: options.query,
		account_id: options.account_id ?? null,
		search_fields: options.searchFields,
	})

	const sql_options = {
		where: where,
	}

	switch (options.method) {
		case StatsMethods.COUNT:
			return {
				count: await options.service.count(sql_options),
			}

		case StatsMethods.AVG:
			return {
				avg: await options.service.avg(sql_options),
			}

		case StatsMethods.SUM:
			return {
				sum: await options.service.sum(sql_options),
			}
	}
}

export async function crudCharts<T>(options: {
	service: any
	tQuery: TQuery<T>
	query: any
	account_id?: number
	search: string
	period?: ChartsPeriod
	from?: Date
	to?: Date
	fields: string[]
	searchFields: string[]
}): Promise<ChartsResponseDto> {
	const fields = _.castArray(options.fields)

	const where = options.tQuery.buildWhere({
		repository: options.service.repository,
		query: options.query,
		account_id: options.account_id ?? null,
		search_fields: options.searchFields,
	})

	const promises = fields.map(
		async field =>
			await options.service.charts(field, {
				period: options.period,
				from: options.from,
				to: options.to,
				where: where,
			}),
	)

	const results = await Promise.all(promises)

	const datasets = fields.map((field, index) => {
		return {
			label: field,
			data: results[index],
		}
	})

	return {
		datasets,
	}
}

export async function crudUpdate<T>(options: {
	service: any
	data: any
	primaryKey: number
	account_id?: number
}): Promise<T> {
	const PRIMARY_KEY = TypeOrm.getPrimaryKey<T>(options.service.repository)

	if (options.account_id) {
		const record = await options.service.findById(options.primaryKey)
		if (record.account.account_id !== options.account_id) {
			throw new BadRequestException(
				`You do not have permission to update this ${options.service.name} with #${options.primaryKey}`,
			)
		}
	}

	if (!options.primaryKey) {
		throw new BadRequestException(`Missing required field: ${PRIMARY_KEY}`)
	}

	return await options.service.update({
		[PRIMARY_KEY]: options.primaryKey,
		...options.data,
	})
}

export async function crudBulkUpload<T>(options: {
	fields: string[]
	dedup_field: string
	mappers?: object
	import_mode?: ImportMode
	upload_type?: UploadType
	service: any
	account_id?: number
	file?: Express.Multer.File
	raw?: any
}): Promise<InsertResult | DeleteResult> {
	const arrays = new Arrays()
	const csv = new Csv()

	if (!options.file && !options.raw) {
		throw new BadRequestException(`Missing required field: file or raw`)
	}

	if (!options.upload_type) {
		options.upload_type = UploadType.CSV
	}

	if (!options.import_mode) {
		options.import_mode = ImportMode.CREATE
	}

	if (!options.fields) {
		throw new InternalServerErrorException(`Missing required field: fields`)
	}

	if (!options.dedup_field) {
		throw new InternalServerErrorException(`Missing required field: dedup_field`)
	}

	switch (options.upload_type) {
		case UploadType.CSV:
			let csv_file: any[]

			if (options.file) {
				if (!Boolean(options.file.mimetype.match(/(csv)/))) {
					throw new BadRequestException(`Not a valid ${options.upload_type} file`)
				}
				csv_file = await csv.parseCsvFile(options.file)
			} else if (options.raw) {
				const { unlink, file } = await csv.createTempCSVFileFromString(options.raw)
				csv_file = await csv.parseCsvFile(file)
				await unlink()
			}

			if (options.mappers) {
				csv_file = arrays.replaceObjectKeys(csv_file, options.mappers)
			}

			if (Object.keys(csv_file[0]).length !== options.fields.length) {
				throw new BadRequestException(
					`Invalid ${options.upload_type} file. Expected ${options.fields.length} columns, got ${csv_file[0].length}`,
				)
			}
			const dtos: DeepPartial<T>[] = csv_file.map(row => {
				const dto = options.fields.reduce(
					(dto, key) => ({
						...dto,
						[key]: row[key],
					}),
					{},
				)
				dto['account_id'] = options.account_id
				return <DeepPartial<T>>_.omitBy(dto, _.isEmpty) // remove empty values
			})
			try {
				return <InsertResult | DeleteResult>(
					await options.service.bulk(dtos, options.import_mode, options.dedup_field)
				)
			} catch (e) {
				throw new BadRequestException(e.message)
			}

		default:
			throw new BadRequestException(`Not a supported file type`)
	}
}

export async function crudDelete<T>(options: { service: any; primaryKey: number; account_id?: number }): Promise<T> {
	const record = await options.service.findById(options.primaryKey)

	if (options.account_id && record.account.account_id !== options.account_id) {
		throw new BadRequestException(
			`You do not have permission to delete this ${options.service.name} with #${options.primaryKey}`,
		)
	}

	return await options.service.remove(record)
}

export async function crudPurge<T>(options: { service: any; primaryKey: number; account_id?: number }): Promise<T> {
	const record = await options.service.findById(options.primaryKey)

	if (options.account_id && record.account.account_id !== options.account_id) {
		throw new BadRequestException(
			`You do not have permission to delete this ${options.service.name} with #${options.primaryKey}`,
		)
	}

	return await options.service.purge(record)
}
