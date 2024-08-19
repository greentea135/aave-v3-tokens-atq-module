import fetch from "node-fetch";
import { ContractTag, ITagService } from "atq-types";

// Define the subgraph URLs
const SUBGRAPH_URLS: Record<string, { decentralized: string }> = {
  // Ethereum Mainnet subgraph
  "1": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk",
  },
  // Optimism subgraph
  "10": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/3RWFxWNstn4nP3dXiDfKi9GgBoHx7xzc7APkXs1MLEgi",
  },
  // BSC subgraph
  "56": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/43jbGkvSw55sMvYyF6MZieksmJbajMu3hNGF8PN9ucuP",
  },
  // Gnosis subgraph
  "100": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/GiNMLDxT1Bdn2dQZxjQLmW24uwpc3geKUBW8RP6oEdg",
  },
  // Fantom subgraph
  "250": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/ZcLcVKJNQboeqACXhGuL3WFLBZzf5uUWheNsaFvLph6",
  },
  // Base subgraph
  "8453": {
    decentralized:
      "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/D7mapexM5ZsQckLJai2FawTKXJ7CqYGKM8PErnS3cJi9",
  },
  // Scroll subgraph (currently commented out due to returning BSC results)
  //"534352": {
  //  decentralized:
  //    "https://gateway.thegraph.com/api/[api-key]/subgraphs/id/DkvXMxq1skgSe1ehLHWpiUthHU1znnMDK2SUmj9avhEX",
  //},
  // Harmony subgraph
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
query MyQuery {
  markets {
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
  subgraphUrl: string
): Promise<Token[]> {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: GET_MARKETS_QUERY,
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

  // Extract token data from the markets
  const tokens: Token[] = [];
  result.data.markets.forEach(market => {
    if (market.outputToken) tokens.push(market.outputToken);
    if (market._sToken) tokens.push(market._sToken);
    if (market._vToken) tokens.push(market._vToken);
  });

  return tokens;
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

// Function to transform token data into ContractTag objects
function transformTokensToTags(chainId: string, tokens: Token[]): ContractTag[] {
  const validTokens: Token[] = [];
  const rejectedNames: string[] = [];

  tokens.forEach((token) => {
    const nameInvalid = containsInvalidValue(token.name);
    const symbolInvalid = containsInvalidValue(token.symbol);

    if (nameInvalid || symbolInvalid) {
      // Reject tokens where the name or symbol is empty or contains invalid content
      if (nameInvalid) {
        rejectedNames.push(`Token: ${token.id} rejected due to invalid name - Name: ${token.name}`);
      }
      if (symbolInvalid) {
        rejectedNames.push(`Token: ${token.id} rejected due to invalid symbol - Symbol: ${token.symbol}`);
      }
    } else {
      validTokens.push(token);
    }
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
  // Using an arrow function for returnTags
  returnTags = async (
    chainId: string,
    apiKey: string
  ): Promise<ContractTag[]> => {
    let allTags: ContractTag[] = [];
    let isMore = true;

    const url = prepareUrl(chainId, apiKey);

    while (isMore) {
      try {
        const tokens = await fetchData(url);
        allTags.push(...transformTokensToTags(chainId, tokens));

        // Determine if there's more data to fetch
        isMore = tokens.length === 100; // Adjust the condition based on your data pagination
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

