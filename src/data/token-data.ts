
export type TokenData = { category: string; tokenAddress: string; tokenSymbol: string; };

export function getTokenDataMap(): Record<string, TokenData> {
    const useFullTable = false;
    const useTestTable = false;
    if (useFullTable)
        return getTokenDataMapFull()
    else if (useTestTable)
         return getTokenDataMapTest();
    return getTokenDataMapFocused();
}

export function getTokenDataMapFocused(): Record<string, TokenData> {
    return {
        "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh": {
            category: "LST",
            tokenAddress: "So11111111111111111111111111111111111111112",
            tokenSymbol: "SOL",
        },
        "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB": {
            category: "Stable",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenSymbol: "USDC",
        },
        "Dj2CwMF3GM7mMT5hcyGXKuYSQ2kQ5zaVCkA1zX1qaTva": {
            category: "Stable",
            tokenAddress: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
            tokenSymbol: "USDG",
        },
        "FDsf8sj6SoV313qrA91yms3u5b3P4hBxEPvanVs8LtJV": {
            category: "Stable",
            tokenAddress: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
            tokenSymbol: "USDS",
        },
        "8UEiPmgZHXXEDrqLS3oiTxQxTbeYTtPbeMBxAd2XGbpu": {
            category: "Stable",
            tokenAddress: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
            tokenSymbol: "PYUSD",
        },
        "HmpMfL8942u22htC4EMiWgLX931g3sacXFR6KjuLgKLV": {
            category: "Stable",
            tokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            tokenSymbol: "USDT",
        },
    };
}

function getTokenDataMapFull(): Record<string, TokenData> {
    return {
        "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh": {
            category: "LST",
            tokenAddress: "So11111111111111111111111111111111111111112",
            tokenSymbol: "SOL",
        },
        "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB": {
            category: "Stable",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenSymbol: "USDC",
        },
        "Dj2CwMF3GM7mMT5hcyGXKuYSQ2kQ5zaVCkA1zX1qaTva": {
            category: "Stable",
            tokenAddress: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
            tokenSymbol: "USDG",
        },
        "FDsf8sj6SoV313qrA91yms3u5b3P4hBxEPvanVs8LtJV": {
            category: "Stable",
            tokenAddress: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
            tokenSymbol: "USDS",
        },
        "8UEiPmgZHXXEDrqLS3oiTxQxTbeYTtPbeMBxAd2XGbpu": {
            category: "Stable",
            tokenAddress: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
            tokenSymbol: "PYUSD",
        },
        "GJCi1uj3kYPZ64puA5sLUiCQfFapxT2xnREzrbDzFkYY": {
            category: "LST",
            tokenAddress: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
            tokenSymbol: "hSOL",
        },
        "8LaUZadNqtzuCG7iCvZd7d5cbquuYfv19KjAg6GPuuCb": {
            category: "LST",
            tokenAddress: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
            tokenSymbol: "jupSOL",
        },
        "BeNBJrAh1tZg5sqgt8D6AWKJLD5KkBrfZvtcgd7EuiAR": {
            category: "Stable",
            tokenAddress: "7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT",
            tokenSymbol: "UXD",
        },
        "HmpMfL8942u22htC4EMiWgLX931g3sacXFR6KjuLgKLV": {
            category: "Stable",
            tokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            tokenSymbol: "USDT",
        },
        "22DcjMZrMwC5Bpa5AGBsmjc5V9VuQrXG6N9ZtdUNyYGE": {
            category: "LST",
            tokenAddress: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
            tokenSymbol: "mSOL",
        },
        "DMoqjmsuoru986HgfjqrKEvPv8YBufvBGADHUonkadC5": {
            category: "LST",
            tokenAddress: "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp",
            tokenSymbol: "LST",
        },
        "Bohoc1ikHLD7xKJuzTyiTyCwzaL5N7ggJQu75A8mKYM8": {
            category: "LST",
            tokenAddress: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
            tokenSymbol: "JitoSOL",
        },
        "NA": {
            category: "LST",
            tokenAddress: "sctmB7GPi5L2Q5G9tUSzXvhZ4YiDMEGcRov9KfArQpx",
            tokenSymbol: "dfdvSOL",
        },
    };
}


function getTokenDataMapTest(): Record<string, TokenData> {
    return {
        "2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB": {
            category: "Stable",
            tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenSymbol: "USDC",
        },
        "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh": {
            category: "LST",
            tokenAddress: "So11111111111111111111111111111111111111112",
            tokenSymbol: "SOL",
        },
    };
}




