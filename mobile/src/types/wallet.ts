export interface SicoobBankInfo {
  institution: string;
  code: string;
  cooperative: string;
  accountNumber: string;
  corporateName: string;
  status: string;
  protocol: string;
  developerPortalUrl: string;
  lastSync: string;
}

export interface SicoobWalletMetrics {
  monthlyCreditLimit: number;
  balanceAvailable: number;
  totalSpentMonth: number;
  totalLitersMonth: number;
  averagePricePerLiter: number;
  fuelType: string;
  fuelingCount: number;
}

export interface SicoobTransaction {
  id: number;
  timestamp: string;
  stationName: string;
  brand: string;
  truckPlate: string;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  authProtocol: string;
}

export interface WalletResponse {
  bank: SicoobBankInfo;
  wallet: SicoobWalletMetrics;
  transactions: SicoobTransaction[];
}
