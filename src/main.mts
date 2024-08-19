import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

// Define URLs for various subgraphs, replace `[api-key]` with your actual API key.
const SUBGRAPH_URLS: Record<string, { decentralized: string }> = {
  // Ethereum Mainnet subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "1": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
  },
  // Optimism subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "10": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/3RWFxWNstn4nP3dXiDfKi9GgBoHx7xzc7APkXs1MLEgi",
  },
  // BSC subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "56": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/43jbGkvSw55sMvYyF6MZieksmJbajMu3hNGF8PN9ucuP",
  },
  // Gnosis subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "100": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/GiNMLDxT1Bdn2dQZxjQLmW24uwpc3geKUBW8RP6oEdg",
  },
  // Fantom subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "250": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/ZcLcVKJNQboeqACXhGuL3WFLBZzf5uUWheNsaFvLph6",
  },
  // Base subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "8453": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/D7mapexM5ZsQckLJai2FawTKXJ7CqYGKM8PErnS3cJi9",
  },
  // Scroll subgraph (currently commented out due to returning BSC results), by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  //"534352": {
  //  decentralized:
  //    "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/DkvXMxq1skgSe1ehLHWpiUthHU1znnMDK2SUmj9avhEX",
  //},
  // Harmony subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "1666600000": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/G1BNHqmteZiUwSEacfXG2nzMm13KLNo5xoxv62ErAyQv",
  },
};

// Define the interfaces according to the new GraphQL query.
interface MarketToken {
  id: string;
  name: string;
  symbol: string;
}

interface Market {
  outputToken: MarketToken;
  _sToken: MarketToken;
  _vToken: MarketToken;
  createdTimestamp: number;
}

interface GraphQLData {
  markets: Market[];
}

interface GraphQLResponse {
  data?: GraphQLData;
  errors?: { message: string }[]; // Handle GraphQL errors
}

// Define the GraphQL query for fetching markets with a timestamp filter.
const GET_MARKETS_QUERY = `
query GetMarkets($lastTimestamp: Int) {
  markets(
    first: 1000,
    orderBy: createdTimestamp,
    orderDirection: asc,
    where: { createdTimestamp_gt: $lastTimestamp }
  ) {
    outputToken {
      id
      name
      symbol
    }
    _sToken {
      id
      name
      symbol
    }
    _vToken {
      id
      name
      symbol
    }
    createdTimestamp
  }
}
`;

// Define headers for the GraphQL query request.
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Function to check if an error is an instance of Error.
function isError(e: unknown): e is Error {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as Error).message === "string"
  );
}

// Function to check if a string contains invalid values such as HTML or is empty.
function containsInvalidValue(text: string): boolean {
  const containsHtml = /<[^>]*>/.test(text);
  const isEmpty = text.trim() === "";
  return isEmpty || containsHtml;
}

// Function to truncate a string to a specified maximum length.
function truncateString(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "..."; // Subtract 3 for ellipsis
  }
  return text;
}

// Fetch data from the subgraph and handle potential errors.
async function fetchData(
  subgraphUrl: string,
  lastTimestamp: number
): Promise<Market[]> {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: GET_MARKETS_QUERY,
      variables: { lastTimestamp },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse;
  if (result.errors) {
    result.errors.forEach((error) => {
      console.error(`GraphQL error: ${error.message}`);
    });
    throw new Error("GraphQL errors occurred: see logs for details.");
  }

  if (!result.data || !result.data.markets) {
    throw new Error("No markets data found.");
  }

  return result.data.markets;
}

// Prepare the URL by replacing `[api-key]` with the actual API key.
function prepareUrl(chainId: string, apiKey: string): string {
  const urls = SUBGRAPH_URLS[chainId];
  if (!urls || isNaN(Number(chainId))) {
    const supportedChainIds = Object.keys(SUBGRAPH_URLS).join(", ");

    throw new Error(
      `Unsupported or invalid Chain ID provided: ${chainId}. Only the following values are accepted: ${supportedChainIds}`
    );
  }
  return urls.decentralized.replace("[api-key]", encodeURIComponent(apiKey));
}

// Transform market data into the format expected by ContractTag.
function transformMarketsToTags(chainId: string, markets: Market[]): ContractTag[] {
  const validMarkets: Market[] = [];
  const rejectedNames: string[] = [];

  markets.forEach((market) => {
    const token0Invalid = containsInvalidValue(market.outputToken.name) || containsInvalidValue(market.outputToken.symbol);
    const token1Invalid = containsInvalidValue(market._sToken.name) || containsInvalidValue(market._sToken.symbol);
    const token2Invalid = containsInvalidValue(market._vToken.name) || containsInvalidValue(market._vToken.symbol);

    if (token0Invalid || token1Invalid || token2Invalid) {
      // Reject markets with invalid token data.
      if (token0Invalid) {
        rejectedNames.push(`Market: ${market.outputToken.id} rejected due to invalid token data - OutputToken: ${market.outputToken.name}, Symbol: ${market.outputToken.symbol}`);
      }
      if (token1Invalid) {
        rejectedNames.push(`Market: ${market._sToken.id} rejected due to invalid token data - SToken: ${market._sToken.name}, Symbol: ${market._sToken.symbol}`);
      }
      if (token2Invalid) {
        rejectedNames.push(`Market: ${market._vToken.id} rejected due to invalid token data - VToken: ${market._vToken.name}, Symbol: ${market._vToken.symbol}`);
      }
    } else {
      validMarkets.push(market);
    }
  });

  if (rejectedNames.length > 0) {
    console.log("Rejected markets:", rejectedNames);
  }

  return validMarkets.map((market) => {
    const maxSymbolsLength = 45;
    const symbolsText = `${market.outputToken.symbol}/${market._sToken.symbol}/${market._vToken.symbol}`;
    const truncatedSymbolsText = truncateString(symbolsText, maxSymbolsLength);

    return {
      "Contract Address": `eip155:${chainId}:${market.outputToken.id}`,
      "Public Name Tag": `${truncatedSymbolsText} Market`,
      "Project Name": "Aave v3",
      "UI/Website Link": "https://aave.com",
      "Public Note": `The liquidity market contract on Aave v3 for the ${market.outputToken.name} (${market.outputToken.symbol}), ${market._sToken.name} (${market._sToken.symbol}), and ${market._vToken.name} (${market._vToken.symbol}) tokens.`,
    };
  });
}

// Main logic for the TagService module.
class TagService implements ITagService {
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string
  ): Promise<ContractTag[]> => {
    let lastTimestamp: number = 0;
    let allTags: ContractTag[] = [];
    let isMore = true;

    const url = prepareUrl(chainId, apiKey);

    while (isMore) {
      try {
        const markets = await fetchData(url, lastTimestamp);
        allTags.push(...transformMarketsToTags(chainId, markets));

        isMore = markets.length === 1000; // Check if there might be more data
        if (isMore) {
          lastTimestamp = parseInt(
            markets[markets.length - 1].createdTimestamp.toString(),
            10
          );
        }
      } catch (error) {
        if (isError(error)) {
          console.error(`An error occurred: ${error.message}`);
          throw new Error(`Failed fetching data: ${error}`); // Propagate error with context
        } else {
          console.error("An unknown error occurred.");
          throw new Error("An unknown error occurred during fetch operation."); // Generic error handling
        }
      }
    }
    return allTags;
  };
}

// Create an instance of TagService.
const tagService = new TagService();

// Export the returnTags method directly.
export const returnTags = tagService.returnTags;

