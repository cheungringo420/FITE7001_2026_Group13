// Kalshi Trading Service
// Handles order creation and execution on Kalshi

import { API_ENDPOINTS } from '../wallet/config';

export interface KalshiCredentials {
    apiKeyId: string;
    privateKey: string; // RSA private key for signing
}

export interface KalshiOrderParams {
    ticker: string;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    count: number; // Number of contracts
    type: 'limit' | 'market';
    yesPrice?: number; // Price in cents (1-99) for limit orders
    noPrice?: number;
    expiration?: number; // Unix timestamp
}

export interface KalshiOrderResponse {
    success: boolean;
    orderId?: string;
    status?: string;
    filledCount?: number;
    remainingCount?: number;
    averagePrice?: number;
    error?: string;
}

/**
 * Create HMAC signature for Kalshi API requests
 * Kalshi uses: timestamp + method + path (without query params)
 */
async function createKalshiSignature(
    privateKey: string,
    timestamp: string,
    method: string,
    path: string
): Promise<string> {
    const message = timestamp + method.toUpperCase() + path;

    // Use Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(privateKey);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Place an order on Kalshi
 */
export async function placeKalshiOrder(
    credentials: KalshiCredentials,
    params: KalshiOrderParams
): Promise<KalshiOrderResponse> {
    const timestamp = Date.now().toString();
    const path = '/portfolio/orders';
    const method = 'POST';

    // Determine price based on side
    let price: number | undefined;
    if (params.type === 'limit') {
        price = params.side === 'yes' ? params.yesPrice : params.noPrice;
    }

    const orderPayload = {
        ticker: params.ticker,
        side: params.side,
        action: params.action,
        count: params.count,
        type: params.type,
        ...(price !== undefined && { [params.side === 'yes' ? 'yes_price' : 'no_price']: price }),
        ...(params.expiration && { expiration_ts: params.expiration }),
    };

    const body = JSON.stringify(orderPayload);

    try {
        const signature = await createKalshiSignature(
            credentials.privateKey,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.KALSHI}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'KALSHI-ACCESS-KEY': credentials.apiKeyId,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'KALSHI-ACCESS-TIMESTAMP': timestamp,
            },
            body,
        });

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error };
        }

        const data = await response.json();
        return {
            success: true,
            orderId: data.order?.order_id,
            status: data.order?.status,
            filledCount: data.order?.filled_count,
            remainingCount: data.order?.remaining_count,
            averagePrice: data.order?.average_price,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Cancel an order on Kalshi
 */
export async function cancelKalshiOrder(
    credentials: KalshiCredentials,
    orderId: string
): Promise<{ success: boolean; error?: string }> {
    const timestamp = Date.now().toString();
    const path = `/portfolio/orders/${orderId}`;
    const method = 'DELETE';

    try {
        const signature = await createKalshiSignature(
            credentials.privateKey,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.KALSHI}${path}`, {
            method,
            headers: {
                'KALSHI-ACCESS-KEY': credentials.apiKeyId,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'KALSHI-ACCESS-TIMESTAMP': timestamp,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get user's positions on Kalshi
 */
export async function getKalshiPositions(
    credentials: KalshiCredentials
): Promise<{ positions: unknown[]; error?: string }> {
    const timestamp = Date.now().toString();
    const path = '/portfolio/positions';
    const method = 'GET';

    try {
        const signature = await createKalshiSignature(
            credentials.privateKey,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.KALSHI}${path}`, {
            method,
            headers: {
                'KALSHI-ACCESS-KEY': credentials.apiKeyId,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'KALSHI-ACCESS-TIMESTAMP': timestamp,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            return { positions: [], error };
        }

        const data = await response.json();
        return { positions: data.market_positions || [] };
    } catch (error) {
        return {
            positions: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get user's balance on Kalshi
 */
export async function getKalshiBalance(
    credentials: KalshiCredentials
): Promise<{ balance: number; portfolioValue: number; error?: string }> {
    const timestamp = Date.now().toString();
    const path = '/portfolio/balance';
    const method = 'GET';

    try {
        const signature = await createKalshiSignature(
            credentials.privateKey,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.KALSHI}${path}`, {
            method,
            headers: {
                'KALSHI-ACCESS-KEY': credentials.apiKeyId,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'KALSHI-ACCESS-TIMESTAMP': timestamp,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            return { balance: 0, portfolioValue: 0, error };
        }

        const data = await response.json();
        return {
            balance: data.balance / 100, // Convert cents to dollars
            portfolioValue: data.portfolio_value / 100,
        };
    } catch (error) {
        return {
            balance: 0,
            portfolioValue: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
