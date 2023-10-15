<template>
	<q-card-section class="q-pt-none q-pb-none">
		<div class="text-weight-bold">
			You can define the field mappings. Set mappings to specify the correspondence between fields in the Source
			and fields in the Destination.
		</div>
	</q-card-section>
	<q-card-section>
		<q-select :options="tableOptions" v-model="selectedTable">
			<template v-slot:prepend>
				<q-icon name="table_view" />
			</template>
		</q-select>
		<q-table :columns="columns" :rows="rows" dense hide-bottom>
			<template v-slot:body="props">
				<q-tr>
					<q-td key="source" :props="props">
						{{ props.row.source }}
					</q-td>
					<q-td key="target" :props="props">
						<q-select dense :options="targetFieldOptions" v-model="props.row.target" />
					</q-td>
					<q-td key="primaryKey" :props="props">
						<q-checkbox v-model="props.row.primaryKey" />
					</q-td>
				</q-tr>
			</template>
		</q-table>
	</q-card-section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUploaderStore } from '@/store/uploader'
import { QTableProps } from 'quasar';

const store = useUploaderStore()

const columns: QTableProps['columns'] = [
	{
		name: 'source',
		align: 'left',
		label: 'Source Field',
		field: 'source',
		sortable: false,
	},
	{
		name: 'target',
		align: 'left',
		label: 'Target Field',
		field: 'source',
		sortable: false,
	},
	{
		name: 'primaryKey',
		align: 'left',
		label: 'Primary Key',
		field: 'source',
		sortable: false,
	},
]

// rows in the user-selected file
const rows = ref([
	// { source: 'test', target: ref(''), primaryKey: ref(false) },
])

const tableOptions = computed(() => store.getTables)
const selectedTable = ref('')
const targetFieldOptions = computed(() => store.getFieldsPerTable(selectedTable.value))
</script>