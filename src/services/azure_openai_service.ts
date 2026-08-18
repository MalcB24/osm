import "openai/shims/node";
import OpenAI from "openai";
import type { Fetch } from "openai/core";
import {
  fetch as openaiFetch,
  Headers,
} from "openai/_shims/index";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  DefaultAzureCredential,
  getBearerTokenProvider,
  ManagedIdentityCredential,
} from "@azure/identity";

export class AzureOpenAIService {
  private readonly client: OpenAI;

  private constructor(
    private readonly deployment: string,
    baseURL: string,
    apiVersion: string,
    tokenProvider: () => Promise<string>,
  ) {
    const fetchWithBearerToken: Fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${await tokenProvider()}`);

      return openaiFetch(url, {
        ...init,
        headers,
      });
    };

    this.client = new OpenAI({
      baseURL,
      defaultQuery: {
        "api-version": apiVersion,
      },
      // The SDK type expects a string in this version. Our custom fetch replaces
      // this placeholder with a fresh Entra bearer token for every request.
      apiKey: "entra-token-provider",
      fetch: fetchWithBearerToken,
    });
  }

  static async create(): Promise<AzureOpenAIService> {
    const scope =
      process.env.AZURE_OPENAI_SCOPE ?? "https://ai.azure.com/.default";
    const tokenProvider = getBearerTokenProvider(
      process.env.NODE_ENV == "development" ? new DefaultAzureCredential() : new ManagedIdentityCredential(),
      scope,
    );

    return new AzureOpenAIService(
      getRequiredEnv("AZURE_OPENAI_DEPLOYMENT"),
      normalizeFoundryOpenAIEndpoint(
        getRequiredEnv("AZURE_OPENAI_ENDPOINT"),
      ),
      process.env.AZURE_OPENAI_API_VERSION ?? "v1",
      tokenProvider,
    );
  }

  async getJsonCompletion<T>(
    messages: ChatCompletionMessageParam[],
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<T> {
    const completion = await this.client.responses.create({
      model: this.deployment,
      input: formatMessages(messages),
      max_output_tokens: options.maxTokens ?? 3000,
    });

    const content = completion.output_text;

    if (!content) {
      throw new Error(
        "Azure OpenAI response did not include message content.",
      );
    }

    return parseJsonObject(content) as T;
  }
}

function formatMessages(messages: ChatCompletionMessageParam[]): string {
  return messages
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);

      return `${message.role.toUpperCase()}:\n${content}`;
    })
    .join("\n\n");
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable "${name}".`);
  }

  return value;
}

function normalizeFoundryOpenAIEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.replace(/\/$/, "");

  if (trimmedEndpoint.endsWith("/openai/v1")) {
    return trimmedEndpoint;
  }

  if (trimmedEndpoint.endsWith("/openai")) {
    return `${trimmedEndpoint}/v1`;
  }

  return `${trimmedEndpoint}/openai/v1`;
}

function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Azure OpenAI response was not valid JSON.");
    }

    return JSON.parse(content.slice(start, end + 1));
  }
}
