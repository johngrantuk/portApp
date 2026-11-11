import "server-only";
import type { Address, Chain } from "viem";
import { arbitrum, mainnet, polygon } from "viem/chains";

export type LendingMarket = {
  name: string;
  /** Aave V3 PoolAddressesProvider. Works for any Aave V3 fork (e.g. Spark). */
  addressesProvider: Address;
};

export type ChainConfig = {
  /** Used for env var names (RPC_URL_<KEY>) and holding ids. */
  key: string;
  name: string;
  chain: Chain;
  /** DefiLlama chain prefix, see https://coins.llama.fi */
  llamaChain: string;
  defaultRpcUrl: string;
  /** Alchemy network slug; enables full token discovery when ALCHEMY_API_KEY is set. */
  alchemyNetwork?: string;
  /** Blockscout instance with a working /api/v2 token-balances endpoint (free token discovery). */
  blockscoutUrl?: string;
  native: { symbol: string; llamaId: string };
  /** Tokens always checked, regardless of discovery. Symbol/decimals are read on-chain. */
  tokens: Address[];
  lendingMarkets: LendingMarket[];
};

/**
 * To add a chain: import it from viem/chains, add an entry below and (optionally)
 * set RPC_URL_<KEY> in your env. Find the DefiLlama chain prefix at
 * https://api.llama.fi/chains and Aave markets at https://github.com/bgd-labs/aave-address-book
 */
export const CHAINS: ChainConfig[] = [
  {
    key: "ETHEREUM",
    name: "Ethereum",
    chain: mainnet,
    llamaChain: "ethereum",
    defaultRpcUrl: "https://ethereum-rpc.publicnode.com",
    alchemyNetwork: "eth-mainnet",
    blockscoutUrl: "https://eth.blockscout.com",
    native: { symbol: "ETH", llamaId: "coingecko:ethereum" },
    tokens: [
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", // stETH
      "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", // wstETH
      "0xae78736Cd615f374D3085123A210448E74Fc6393", // rETH
      "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", // cbETH
      "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", // weETH
      "0x35fA164735182de50811E8e2E824cFb9B6118ac2", // eETH
      "0xd5F7838F5C461fEFF7FE49ea5ebaF7728bB0ADfa", // mETH
      "0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38", // osETH
      "0xbf5495Efe5DB9ce00f80364C8B423567e58d2110", // ezETH
      "0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7", // rsETH
      "0xac3E018457B222d93114458476f3E3416Abbe38F", // sfrxETH
      "0xA35b1B31Ce002FBF2058D22F30f95D405200A15b", // ETHx
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      "0xdC035D45d973E3EC169d2276DDab16f1e407384F", // USDS
      "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f", // GHO
      "0xe1753F2E00940cC31213dd92013cf019dfe4Ca1D", // sGHO
      "0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33", // fUSDC (Fluid)
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
      "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
      "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // AAVE
      "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", // LDO
    ],
    lendingMarkets: [
      { name: "Aave V3 Core", addressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" },
      { name: "Aave V3 Lido", addressesProvider: "0xcfBf336fe147D643B9Cb705648500e101504B16d" },
      { name: "Aave V3 EtherFi", addressesProvider: "0xeBa440B438Ad808101d1c451C1C5322c90BEFCdA" },
      { name: "Spark", addressesProvider: "0x02C3eA4e34C0cBd694D2adFa2c690EECbC1793eE" },
    ],
  },
  {
    key: "ARBITRUM",
    name: "Arbitrum",
    chain: arbitrum,
    llamaChain: "arbitrum",
    defaultRpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    alchemyNetwork: "arb-mainnet",
    native: { symbol: "ETH", llamaId: "coingecko:ethereum" },
    tokens: [
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
      "0x5979D7b546E38E414F7E9822514be443A4800529", // wstETH
      "0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8", // rETH
      "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe", // weETH
      "0x1DEBd73E752bEaF79865Fd6446b0c970EaE7732f", // cbETH
      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
      "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC.e
      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
      "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
      "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB
      "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", // LINK
      "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", // GMX
      "0xba5DdD1f9d7F570dc94a51479a000E3BCE967196", // AAVE
    ],
    lendingMarkets: [
      { name: "Aave V3", addressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb" },
    ],
  },
  {
    key: "POLYGON",
    name: "Polygon",
    chain: polygon,
    llamaChain: "polygon",
    defaultRpcUrl: "https://polygon-bor-rpc.publicnode.com",
    alchemyNetwork: "polygon-mainnet",
    native: { symbol: "POL", llamaId: "coingecko:polygon-ecosystem-token" },
    tokens: [
      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
      "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD", // wstETH
      "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WPOL
      "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // WBTC
      "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", // LINK
      "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", // AAVE
      "0xfa68FB4628DFF1028CFEc22b4162FCcd0d45efb6", // MaticX
    ],
    lendingMarkets: [
      { name: "Aave V3", addressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb" },
    ],
  },
];

export function rpcUrlFor(cfg: ChainConfig): string {
  const override = process.env[`RPC_URL_${cfg.key}`];
  if (override) return override;
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey && cfg.alchemyNetwork) {
    return `https://${cfg.alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;
  }
  return cfg.defaultRpcUrl;
}
