import * as dotenv from 'dotenv';

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DEFAULT_LANGUAGE_CODE = 'en';
const MAX_SUGGESTIONS = 5;

export type PlacesAutocompleteMode = 'query' | 'location';

export interface PlacesAutocompleteSuggestion {
    kind: 'place' | 'query';
    placeId?: string;
    text: string;
    mainText?: string;
    secondaryText?: string;
}

interface GooglePlacesText {
    text?: string;
}

interface GooglePlacesStructuredFormat {
    mainText?: GooglePlacesText;
    secondaryText?: GooglePlacesText;
}

interface GooglePlacePrediction {
    placeId?: string;
    text?: GooglePlacesText;
    structuredFormat?: GooglePlacesStructuredFormat;
}

interface GoogleQueryPrediction {
    text?: GooglePlacesText;
}

interface GooglePlacesSuggestion {
    placePrediction?: GooglePlacePrediction;
    queryPrediction?: GoogleQueryPrediction;
}

interface GooglePlacesAutocompleteResponse {
    suggestions?: GooglePlacesSuggestion[];
}

function dedupeSuggestions(
    suggestions: PlacesAutocompleteSuggestion[]
): PlacesAutocompleteSuggestion[] {
    const seen = new Set<string>();

    return suggestions.filter((suggestion) => {
        const key = suggestion.text.trim().toLowerCase();
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function normalizePlacePrediction(
    prediction: GooglePlacePrediction | undefined
): PlacesAutocompleteSuggestion | null {
    if (!prediction) {
        return null;
    }

    const text = prediction?.text?.text?.trim();

    if (!text) {
        return null;
    }

    return {
        kind: 'place',
        placeId: prediction.placeId,
        text,
        mainText: prediction.structuredFormat?.mainText?.text?.trim() || text,
        secondaryText: prediction.structuredFormat?.secondaryText?.text?.trim() || undefined,
    };
}

function normalizeQueryPrediction(
    prediction: GoogleQueryPrediction | undefined
): PlacesAutocompleteSuggestion | null {
    if (!prediction) {
        return null;
    }

    const text = prediction?.text?.text?.trim();

    if (!text) {
        return null;
    }

    return {
        kind: 'query',
        text,
        mainText: text,
    };
}

async function fetchAutocompleteRequest(
    body: Record<string, unknown>
): Promise<GooglePlacesSuggestion[]> {
    if (!GOOGLE_PLACES_API_KEY) {
        throw new Error('GOOGLE_PLACES_API_KEY is not configured.');
    }

    const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': [
                'suggestions.placePrediction.placeId',
                'suggestions.placePrediction.text.text',
                'suggestions.placePrediction.structuredFormat.mainText.text',
                'suggestions.placePrediction.structuredFormat.secondaryText.text',
                'suggestions.queryPrediction.text.text',
            ].join(','),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Places request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as GooglePlacesAutocompleteResponse;
    return data.suggestions ?? [];
}

async function fetchLocationSuggestions(input: string): Promise<PlacesAutocompleteSuggestion[]> {
    const baseBody = {
        input,
        languageCode: DEFAULT_LANGUAGE_CODE,
        includeQueryPredictions: false,
    };

    const citySuggestions = await fetchAutocompleteRequest({
        ...baseBody,
        includedPrimaryTypes: ['(cities)'],
    });

    const normalizedCities = citySuggestions
        .map((suggestion) => normalizePlacePrediction(suggestion.placePrediction))
        .filter((suggestion): suggestion is PlacesAutocompleteSuggestion => suggestion !== null);

    if (normalizedCities.length >= MAX_SUGGESTIONS) {
        return normalizedCities.slice(0, MAX_SUGGESTIONS);
    }

    const regionSuggestions = await fetchAutocompleteRequest({
        ...baseBody,
        includedPrimaryTypes: ['(regions)'],
    });

    const normalizedRegions = regionSuggestions
        .map((suggestion) => normalizePlacePrediction(suggestion.placePrediction))
        .filter((suggestion): suggestion is PlacesAutocompleteSuggestion => suggestion !== null);

    return dedupeSuggestions([...normalizedCities, ...normalizedRegions]).slice(0, MAX_SUGGESTIONS);
}

async function fetchQuerySuggestions(input: string): Promise<PlacesAutocompleteSuggestion[]> {
    const suggestions = await fetchAutocompleteRequest({
        input,
        languageCode: DEFAULT_LANGUAGE_CODE,
        includeQueryPredictions: true,
    });

    const normalizedQuerySuggestions = suggestions
        .map((suggestion) => normalizeQueryPrediction(suggestion.queryPrediction))
        .filter((suggestion): suggestion is PlacesAutocompleteSuggestion => suggestion !== null);

    const normalizedPlaceSuggestions = suggestions
        .map((suggestion) => normalizePlacePrediction(suggestion.placePrediction))
        .filter((suggestion): suggestion is PlacesAutocompleteSuggestion => suggestion !== null);

    return dedupeSuggestions([
        ...normalizedQuerySuggestions,
        ...normalizedPlaceSuggestions,
    ]).slice(0, MAX_SUGGESTIONS);
}

export function isGooglePlacesConfigured(): boolean {
    return Boolean(GOOGLE_PLACES_API_KEY);
}

export async function getPlacesAutocompleteSuggestions(
    input: string,
    mode: PlacesAutocompleteMode
): Promise<PlacesAutocompleteSuggestion[]> {
    const normalizedInput = input.trim();

    if (normalizedInput.length < 3) {
        return [];
    }

    if (mode === 'location') {
        return fetchLocationSuggestions(normalizedInput);
    }

    return fetchQuerySuggestions(normalizedInput);
}
