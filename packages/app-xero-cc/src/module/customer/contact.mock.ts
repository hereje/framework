import { Contact } from 'xero-node'

export default function () {
	return <Contact>{
		contactID: 'bd2270c3-8706-4c11-9cfb-000b551c3f51',
		ContactStatus: 'ACTIVE',
		Name: 'ABC Limited',
		FirstName: 'Andrea',
		LastName: 'Dutchess',
		CompanyNumber: 'NumberBusiness1234',
		EmailAddress: 'a.dutchess@abclimited.com',
		SkypeUserName: 'skype.dutchess@abclimited.com',
		BankAccountDetails: '45465844',
		TaxNumber: '415465456454',
		AccountsReceivableTaxType: 'INPUT2',
		AccountsPayableTaxType: 'OUTPUT2',
		Addresses: [
			{
				AddressType: 'POBOX',
				AddressLine1: 'P O Box 123',
				City: 'Wellington',
				PostalCode: '6011',
				AttentionTo: 'Andrea',
			},
			{
				AddressType: 'STREET',
			},
		],
		Phones: [
			{
				PhoneType: 'DEFAULT',
				PhoneNumber: '1111111',
				PhoneAreaCode: '04',
				PhoneCountryCode: '64',
			},
			{
				PhoneType: 'FAX',
			},
			{
				PhoneType: 'MOBILE',
			},
			{
				PhoneType: 'DDI',
			},
		],
		UpdatedDateUTC: '/Date(1488391422280+0000)/',
		IsSupplier: false,
		IsCustomer: true,
		DefaultCurrency: 'NZD',
	}
}
