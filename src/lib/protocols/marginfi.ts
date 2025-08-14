import { TokenData } from '@/lib/utils'
import { Connection, PublicKey } from '@solana/web3.js'
import {aprToApy, Wallet} from '@mrgnlabs/mrgn-common'
import { MarginfiClient, getConfig } from '@mrgnlabs/marginfi-client-v2'
import {ProtocolDataRow} from "@/lib/types";
import { optimalUtilizationMap } from '@/lib/utils/shared-data';


export async function getMarginfiRates(connection: Connection, tokenData: Record<string, TokenData>) :
    Promise<ProtocolDataRow[]> {

    const mfiClient = await MarginfiClient.fetch(
        getConfig('production'),
        {} as Wallet,
        connection,
    )

    // noinspection UnnecessaryLocalVariableJS
    const bankRates = Object.entries(tokenData)
        .map(([key, metadata]) => {
            try {
                const bankPubkey = new PublicKey(key);
                const bank = mfiClient.getBankByPk(bankPubkey)

                if (!bank) {
                    console.warn('Marginfi market returned null or undefined.')
                    return null
                }

                const factor = 10 ** bank.mintDecimals;
                const rates = bank.computeInterestRates()
                const lendingBaseRate = rates?.lendingRate.toNumber()
                const borrowingBaseRate = rates?.borrowingRate.toNumber()
                const lendingRate_ = aprToApy(lendingBaseRate)
                const borrowingRate_ = aprToApy(borrowingBaseRate)

                const assetQty = bank.getTotalAssetQuantity().toNumber() / factor;
                const liabilityQty = bank.getTotalLiabilityQuantity().toNumber() / factor;
                const liquidity_ = assetQty - liabilityQty;

                const assetWeightInit_ = bank.config.assetWeightInit.toNumber();
                const liabilityWeight_ = bank.config.liabilityWeightInit.toNumber();
                const ltv_ = 1 / liabilityWeight_;
                const utilization_ = bank.computeUtilizationRate().toNumber();

                const bankConfig = bank.config;
                const bankRateConfig = bankConfig.interestRateConfig;
                const optimalUtilization_ = bankRateConfig.optimalUtilizationRate.toNumber();
                const plateauInterestRate_ = bankRateConfig.plateauInterestRate.toNumber();
                const maxInterestRate_ = bankRateConfig.maxInterestRate.toNumber();


                optimalUtilizationMap[metadata.tokenSymbol] = optimalUtilization_;


                const rate: ProtocolDataRow = {
                    protocol: 'Marginfi',
                    token: metadata.tokenSymbol,
                    liquidity: liquidity_,
                    currentUtilization: utilization_,
                    targetUtilization: optimalUtilization_,
                    plateauRate: plateauInterestRate_,
                    maxRate: maxInterestRate_,
                    lendingRate: lendingRate_,
                    borrowingRate: borrowingRate_,
                    collateralWeight: assetWeightInit_,
                    liabilityWeight: liabilityWeight_,
                    ltv: ltv_,
                }

                for (const [key, value] of Object.entries(rate)) {
                    if (value === undefined || value === null) {
                        // @ts-expect-error known SDK type mismatch
                        rate[key] = NaN
                    }
                }

                return rate
            } catch (err) {
                console.warn(`Skipping ${metadata.tokenSymbol}:`, err)
                return null
            }
        })
        .filter((r): r is ProtocolDataRow => r !== null)


    return bankRates
}
