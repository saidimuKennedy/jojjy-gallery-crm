import useSWR, { Fetcher } from "swr";
import {
  ArtworksResponse,
  APIError,
  ArtworkFilters,
  UseArtworksReturn,
  UseSeriesListReturn,
  Series,
} from "@/types/api";

const artworksFetcher: Fetcher<ArtworksResponse, string> = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(
      `HTTP ${response.status}: ${response.statusText}`
    ) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  return (await response.json()) as ArtworksResponse;
};

/** Series GET returns a raw Series[] (not { success, data }). */
const seriesListFetcher: Fetcher<Series[], string> = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(
      `HTTP ${response.status}: ${response.statusText}`
    ) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  if (Array.isArray(data)) return data as Series[];
  if (data?.success && Array.isArray(data.data)) return data.data as Series[];
  throw new Error(data?.message || "Failed to load series");
};

const defaultSWRConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
};

export function useArtworks(filters: ArtworkFilters = {}): UseArtworksReturn {
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });
  if (!queryParams.has("limit")) {
    queryParams.set("limit", "all");
  }
  const url = `/api/artworks?${queryParams.toString()}`;

  const { data, error, mutate, isValidating } = useSWR<
    ArtworksResponse,
    APIError
  >(url, artworksFetcher, defaultSWRConfig);

  return {
    artworks: data?.data || [],
    total: data?.total || data?.data?.length || 0,
    isLoading: !error && !data,
    isValidating,
    error: error?.message,
    mutate,
  };
}

export function useSeriesList(): UseSeriesListReturn {
  const { data, error, mutate, isValidating } = useSWR<Series[], APIError>(
    "/api/series",
    seriesListFetcher,
    defaultSWRConfig
  );

  return {
    seriesList: data || [],
    isLoading: !error && !data,
    isValidating,
    error: error?.message,
    mutate,
  };
}
