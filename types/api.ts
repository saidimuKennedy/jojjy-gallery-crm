// src/types/api.ts (or your equivalent types file)

import {
  Artwork as PrismaArtwork,
  Transaction as PrismaTransaction,
  User as PrismaUser,
  Series as PrismaSeries,
  // MODIFIED: Renamed import from MediaFile to ArtworkMediaFile
  ArtworkMediaFile as PrismaArtworkMediaFile,
  SeriesMediaFile as PrismaSeriesMediaFile,
  // NEW: Import for MediaBlogEntry and MediaBlogFile
  MediaBlogEntry as PrismaMediaBlogEntry,
  MediaBlogFile as PrismaMediaBlogFile,
  // NEW: Import enums for MediaBlogEntryType and MediaFileType
  MediaBlogEntryType as PrismaMediaBlogEntryType,
  MediaFileType as PrismaMediaFileType,
} from "@prisma/client";

export interface APIError {
  success?: false;
  message: string;
  status?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

export interface Series extends Omit<PrismaSeries, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

// MODIFIED: Renamed interface from MediaFile to ArtworkMediaFile
export interface ArtworkMediaFile
  extends Omit<
    PrismaArtworkMediaFile, // MODIFIED: Using PrismaArtworkMediaFile
    "createdAt" | "updatedAt" | "description" | "thumbnailUrl" | "type"
  > {
  createdAt: string;
  updatedAt: string;
  description: string | null;
  thumbnailUrl: string | null;
  type: PrismaMediaFileType; // NEW: Added type field from enum
}

export interface SeriesMediaFile
  extends Omit<
    PrismaSeriesMediaFile,
    "createdAt" | "updatedAt" | "description" | "thumbnailUrl" | "type"
  > {
  createdAt: string;
  updatedAt: string;
  description: string | null;
  thumbnailUrl: string | null;
  type: PrismaMediaFileType;
}

export interface Artwork
  extends Omit<
    PrismaArtwork,
    | "price"
    | "createdAt"
    | "updatedAt"
    | "description"
    | "dimensions"
    | "year"
    | "medium"
    | "isAvailable"
    // | "featured" // Assuming 'featured' was removed from PrismaArtwork based on Artwork in schema.prisma
    | "seriesId"
    | "inGallery"
    | "reservedUntil"
    | "reservedByUserId"
  > {
  price: number | null;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  dimensions: string | null;
  year: number | null;
  medium: string | null;
  isAvailable: boolean | null;
  inGallery: boolean;
  reservedUntil: string | null;
  /** Present on public artwork responses; true only for the session user who holds the hold. */
  reservedByCurrentUser?: boolean;
}

export interface Transaction
  extends Omit<
    PrismaTransaction,
    "amount" | "timestamp" | "createdAt" | "updatedAt"
  > {
  amount: number;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User extends Omit<PrismaUser, "createdAt" | "updatedAt"> {
  createdAt?: string;
  updatedAt?: string;
}

// MODIFIED: Updated ArtworkWithRelations to use ArtworkMediaFile
export interface ArtworkWithRelations extends Artwork {
  transactions?: Transaction[];
  series?: Series | null;
  mediaFiles?: ArtworkMediaFile[]; // MODIFIED: Changed to ArtworkMediaFile[]
}

// MODIFIED: Updated ArtworkWithFullRelations to use ArtworkMediaFile
export interface ArtworkWithFullRelations extends Artwork {
  transactions?: (Transaction & {
    user?: User;
  })[];
  series?: Series | null;
  mediaFiles?: ArtworkMediaFile[]; // MODIFIED: Changed to ArtworkMediaFile[]
}

// NEW: Interface for Media Blog Entry
export interface MediaBlogEntry
  extends Omit<
    PrismaMediaBlogEntry,
    "createdAt" | "updatedAt" | "shortDesc" | "externalLink" | "type"
  > {
  createdAt: string;
  updatedAt: string;
  shortDesc: string | null;
  externalLink: string | null;
  type: PrismaMediaBlogEntryType; // New field from enum
}

// NEW: Interface for Media Blog File
export interface MediaBlogFile
  extends Omit<
    PrismaMediaBlogFile,
    "createdAt" | "updatedAt" | "description" | "thumbnailUrl" | "type"
  > {
  createdAt: string;
  updatedAt: string;
  url: string;
  description: string | null;
  thumbnailUrl: string | null;
  type: PrismaMediaFileType; // New field from enum
  order: number;
}

// NEW: Interface for Media Blog Entry with its associated files
export interface MediaBlogEntryWithRelations extends MediaBlogEntry {
  mediaFiles?: MediaBlogFile[];
}

export type ArtworkResponse = APIResponse<ArtworkWithRelations>;
export type ArtworksResponse = APIResponse<ArtworkWithRelations[]>;
export type ArtworkWithFullRelationsResponse =
  APIResponse<ArtworkWithFullRelations>;

// NEW: Types for Media Blog Entry API responses
export type MediaBlogEntryResponse = APIResponse<MediaBlogEntryWithRelations>;
export type MediaBlogEntriesResponse = APIResponse<
  MediaBlogEntryWithRelations[]
>;

export interface SeriesWithArtworks extends Series {
  artworks: Artwork[];
  mediaFiles?: SeriesMediaFile[];
}
export type SeriesResponse = APIResponse<SeriesWithArtworks>;
export type SeriesListResponse = APIResponse<Series[]>;

export interface ArtworkFilters {
  category?: string;
  price?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  artist?: string;
  medium?: string;
  year?: number;
  isAvailable?: boolean;
  status?: string;
  seriesId?: number;
  sort?:
    | "price_asc"
    | "price_desc"
    | "name_asc"
    | "name_desc"
    | "year_asc"
    | "year_desc"
    | "views_asc"
    | "views_desc";
  page?: number;
  limit?: number | "all";
  [key: string]: string | number | boolean | undefined;
}

export interface PaymentSuccessData {
  transactionId: string;
  artworkIds: number[];
  status: "pending" | "confirmed" | "failed";
  amount: number;
  phoneNumber: string;
  timestamp: string;
  stkResponse: {};
}

export interface PaymentResponse {
  success: boolean;
  message?: string;
  data?: PaymentSuccessData;
  error?: string;
}

export interface PaymentErrorData {
  success: boolean;
  message: string;
  error?: string;
}

export interface CartPaymentRequestData {
  phoneNumber: string;
  artworkIds: number[];
}

export function convertPrismaSeriesToAPI(series: PrismaSeries): Series {
  return {
    ...series,
    createdAt: series.createdAt.toISOString(),
    updatedAt: series.updatedAt.toISOString(),
  };
}

export function convertPrismaArtworkToAPI(artwork: PrismaArtwork): Artwork {
  // reservedByUserId is intentionally dropped: it would leak another user's
  // id to any visitor viewing this artwork.
  const { reservedByUserId, ...rest } = artwork;
  return {
    ...rest,
    price: artwork.price.toNumber(),
    createdAt: artwork.createdAt.toISOString(),
    updatedAt: artwork.updatedAt.toISOString(),
    reservedUntil: artwork.reservedUntil
      ? artwork.reservedUntil.toISOString()
      : null,
  };
}

// MODIFIED: Renamed and updated function to convert PrismaArtworkMediaFile to API type
export function convertPrismaArtworkMediaFileToAPI(
  mediaFile: PrismaArtworkMediaFile
): ArtworkMediaFile {
  // MODIFIED: Return type changed
  return {
    ...mediaFile,
    createdAt: mediaFile.createdAt.toISOString(),
    updatedAt: mediaFile.updatedAt.toISOString(),
    // Type is already a string, no conversion needed unless it's an enum type
    type: mediaFile.type as PrismaMediaFileType, // Ensure type is correctly cast
  };
}

export function convertPrismaSeriesMediaFileToAPI(
  mediaFile: PrismaSeriesMediaFile
): SeriesMediaFile {
  return {
    ...mediaFile,
    createdAt: mediaFile.createdAt.toISOString(),
    updatedAt: mediaFile.updatedAt.toISOString(),
    description: mediaFile.description || null,
    thumbnailUrl: mediaFile.thumbnailUrl || null,
    type: mediaFile.type as PrismaMediaFileType,
  };
}

// NEW: Function to convert PrismaMediaBlogEntry to API type
export function convertPrismaMediaBlogEntryToAPI(
  entry: PrismaMediaBlogEntry
): MediaBlogEntry {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    shortDesc: entry.shortDesc || null,
    externalLink: entry.externalLink || null,
    type: entry.type as PrismaMediaBlogEntryType, // Ensure enum type
  };
}

// NEW: Function to convert PrismaMediaBlogFile to API type
export function convertPrismaMediaBlogFileToAPI(
  file: PrismaMediaBlogFile
): MediaBlogFile {
  return {
    ...file,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    description: file.description || null,
    thumbnailUrl: file.thumbnailUrl || null,
    type: file.type as PrismaMediaFileType, // Ensure enum type
  };
}

export function convertPrismaTransactionToAPI(
  transaction: PrismaTransaction
): Transaction {
  return {
    ...transaction,
    amount: transaction.amount.toNumber(),
    timestamp: transaction.timestamp.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

export function convertPrismaUserToAPI(user: PrismaUser): User {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// MODIFIED: Updated convertPrismaArtworkWithRelationsToAPI
export function convertPrismaArtworkWithRelationsToAPI(
  artwork: PrismaArtwork & {
    transactions?: PrismaTransaction[];
    series?: PrismaSeries | null;
    mediaFiles?: PrismaArtworkMediaFile[]; // MODIFIED: Changed to PrismaArtworkMediaFile[]
  }
): ArtworkWithRelations {
  return {
    ...convertPrismaArtworkToAPI(artwork),
    transactions: artwork.transactions?.map(convertPrismaTransactionToAPI),
    series: artwork.series ? convertPrismaSeriesToAPI(artwork.series) : null,
    mediaFiles: artwork.mediaFiles?.map(convertPrismaArtworkMediaFileToAPI), // MODIFIED: Changed function call
  };
}

// NEW: Function to convert PrismaMediaBlogEntryWithRelations to API type
export function convertPrismaMediaBlogEntryWithRelationsToAPI(
  entry: PrismaMediaBlogEntry & {
    mediaFiles?: PrismaMediaBlogFile[];
  }
): MediaBlogEntryWithRelations {
  return {
    ...convertPrismaMediaBlogEntryToAPI(entry),
    mediaFiles: entry.mediaFiles?.map(convertPrismaMediaBlogFileToAPI),
  };
}

export function convertPrismaSeriesWithArtworksToAPI(
  series: PrismaSeries & {
    artworks?: PrismaArtwork[];
    mediaFiles?: PrismaSeriesMediaFile[];
  }
): SeriesWithArtworks {
  return {
    ...convertPrismaSeriesToAPI(series),
    artworks: series.artworks
      ? series.artworks.map(convertPrismaArtworkToAPI)
      : [],
    mediaFiles: series.mediaFiles
      ? series.mediaFiles.map(convertPrismaSeriesMediaFileToAPI)
      : [],
  };
}

export interface UseArtworksReturn {
  artworks: ArtworkWithRelations[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}

export interface UseArtworkReturn {
  artwork: ArtworkWithRelations | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}

export interface UseSeriesReturn {
  series: SeriesWithArtworks | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}

export interface UseSeriesListReturn {
  seriesList: Series[];
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}

// NEW: UseMediaBlogEntriesReturn
export interface UseMediaBlogEntriesReturn {
  mediaBlogEntries: MediaBlogEntryWithRelations[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}

// NEW: UseMediaBlogEntryReturn
export interface UseMediaBlogEntryReturn {
  mediaBlogEntry: MediaBlogEntryWithRelations | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: string | undefined;
  mutate: () => void;
}
