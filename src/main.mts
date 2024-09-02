import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

// Define the subgraph URLs
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
  // Arbitrum subgraph, by subgraphs.messari.eth (0x7e8f317a45d67e27e095436d2e0d47171e7c769f)
  "42161": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/4xyasjQeREe7PxnF6wVdobZvCw5mhoHZq3T7guRpuNPf",
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

// Define the Token interface
interface Token {
  id: string;
  name: string;
  symbol: string;
}

// Define the Market interface with optional token types
interface Market {
  createdTimestamp: number;
  outputToken?: Token;
  _sToken?: Token;
  _vToken?: Token;
}

// Define the GraphQL response structure
interface GraphQLData {
  markets: Market[];
}

interface GraphQLResponse {
  data?: GraphQLData;
  errors?: { message: string }[]; // Assuming the API might return errors in this format
}

// Define headers for the query
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Define the GraphQL query
const GET_MARKETS_QUERY = `
query GetMarkets($lastTimestamp: Int) {
  markets(
    first: 1000,
    orderBy: createdTimestamp,
    orderDirection: asc,
    where: { createdTimestamp_gt: $lastTimestamp }
  ) {
    createdTimestamp
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
  }
}
`;

// Type guard for errors
function isError(e: unknown): e is Error {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as Error).message === "string"
  );
}

// Function to check for invalid values
function containsInvalidValue(text: string): boolean {
  const containsHtml = /<[^>]*>/.test(text);
  const isEmpty = text.trim() === "";
  return isEmpty || containsHtml;
}

// Function to truncate strings
function truncateString(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + "..."; // Subtract 3 for the ellipsis
  }
  return text;
}

// Function to fetch data from the GraphQL endpoint
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

// Function to prepare the URL with the provided API key
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

// Function to transform market data into ContractTag objects
function transformMarketsToTags(chainId: string, markets: Market[]): ContractTag[] {
  const validTokens: Token[] = [];
  const rejectedNames: string[] = [];

  markets.forEach((market) => {
    const tokens = [market.outputToken, market._sToken, market._vToken];
    tokens.forEach((token) => {
      if (token) {
        const nameInvalid = containsInvalidValue(token.name);
        const symbolInvalid = containsInvalidValue(token.symbol);

        if (nameInvalid || symbolInvalid) {
          if (nameInvalid) {
            rejectedNames.push(`Token: ${token.id} rejected due to invalid name - Name: ${token.name}`);
          }
          if (symbolInvalid) {
            rejectedNames.push(`Token: ${token.id} rejected due to invalid symbol - Symbol: ${token.symbol}`);
          }
        } else {
          validTokens.push(token);
        }
      }
    });
  });

  if (rejectedNames.length > 0) {
    console.log("Rejected tokens:", rejectedNames);
  }

  return validTokens.map((token) => {
    const maxSymbolsLength = 45;
    const truncatedSymbolsText = truncateString(token.symbol, maxSymbolsLength);

    return {
      "Contract Address": `eip155:${chainId}:${token.id}`,
      "Public Name Tag": `${truncatedSymbolsText} Token`,
      "Project Name": "Aave V3",
      "UI/Website Link": "https://aave.com",
      "Public Note": `Aave V3's official ${token.name} token contract.`,
    };
  });
}

// The main logic for this module
class TagService implements ITagService {
  returnTags = async (
    chainId: string,
    apiKey: string
  ): Promise<ContractTag[]> => {
    let allTags: ContractTag[] = [];
    let lastTimestamp: number = 0;
    let isMore = true;

    const url = prepareUrl(chainId, apiKey);

    while (isMore) {
      try {
        const markets = await fetchData(url, lastTimestamp);
        const tags = transformMarketsToTags(chainId, markets);
        allTags.push(...tags);

        isMore = markets.length === 1000; // Continue if we fetched 1000 records
        if (isMore) {
          lastTimestamp = Math.max(...markets.map(m => m.createdTimestamp));
        }
      } catch (error) {
        if (isError(error)) {
          console.error(`An error occurred: ${error.message}`);
          throw new Error(`Failed fetching data: ${error}`); // Propagate a new error with more context
        } else {
          console.error("An unknown error occurred.");
          throw new Error("An unknown error occurred during fetch operation."); // Throw with a generic error message if the error type is unknown
        }
      }
    }
    return allTags;
  };
}

// Creating an instance of TagService
const tagService = new TagService();

// Exporting the returnTags method directly
export const returnTags = tagService.returnTags;

