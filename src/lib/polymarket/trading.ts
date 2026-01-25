// Polymarket Trading Service
// Handles order creation and execution on Polymarket CLOB

import { API_ENDPOINTS } from '../wallet/config';

export interface PolymarketCredentials {
    apiKey: string;
    secret: string;
    passphrase: string;
}

export interface CreateOrderParams {
    tokenId: string;
    side: 'BUY' | 'SELL';
    size: number; // Amount of contracts
    price: number; // Price per contract (0-1)
    orderType?: 'GTC' | 'GTD' | 'FOK' | 'FAK';
    expiration?: number; // Unix timestamp for GTD orders
}

export interface OrderResponse {
    success: boolean;
    orderId?: string;
    status?: string;
    filledAmount?: number;
    averagePrice?: number;
    error?: string;
}

/**
 * Derive API credentials from wallet signature
 * User signs a message with their wallet, we derive API keys from it
 */
export async function deriveApiCredentials(
    address: string,
    signMessage: (message: string) => Promise<string>
): Promise<PolymarketCredentials> {
    // Generate nonce for key derivation
    const nonce = Date.now().toString();
    const message = `Sign this message to derive your Polymarket API credentials.\n\nAddress: ${address}\nNonce: ${nonce}`;

    // User signs the message
    const signature = await signMessage(message);

    // Request API key derivation from Polymarket
    const response = await fetch(`${API_ENDPOINTS.POLYMARKET_CLOB}/auth/derive-api-key`, {
        method: 'GET',
        headers: {
            'POLY-ADDRESS': address,
            'POLY-SIGNATURE': signature,
            'POLY-TIMESTAMP': nonce,
            'POLY-NONCE': '0', // First time derivation
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to derive API credentials: ${error}`);
    }

    const data = await response.json();
    return {
        apiKey: data.apiKey,
        secret: data.secret,
        passphrase: data.passphrase,
    };
}

/**
 * Create HMAC signature for authenticated requests
 */
async function createSignature(
    secret: string,
    timestamp: string,
    method: string,
    path: string,
    body: string = ''
): Promise<string> {
    const message = timestamp + method + path + body;

    // Use Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
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
 * Place an order on Polymarket
 */
export async function placeOrder(
    credentials: PolymarketCredentials,
    params: CreateOrderParams
): Promise<OrderResponse> {
    const timestamp = Date.now().toString();
    const path = '/orders';
    const method = 'POST';

    const orderPayload = {
        tokenId: params.tokenId,
        side: params.side,
        size: params.size.toString(),
        price: params.price.toString(),
        orderType: params.orderType || 'GTC',
        ...(params.expiration && { expiration: params.expiration }),
    };

    const body = JSON.stringify(orderPayload);

    try {
        const signature = await createSignature(
            credentials.secret,
            timestamp,
            method,
            path,
            body
        );

        const response = await fetch(`${API_ENDPOINTS.POLYMARKET_CLOB}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'POLY-API-KEY': credentials.apiKey,
                'POLY-SIGNATURE': signature,
                'POLY-TIMESTAMP': timestamp,
                'POLY-PASSPHRASE': credentials.passphrase,
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
            orderId: data.orderId,
            status: data.status,
            filledAmount: data.filledAmount,
            averagePrice: data.averagePrice,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Cancel an order
 */
export async function cancelOrder(
    credentials: PolymarketCredentials,
    orderId: string
): Promise<{ success: boolean; error?: string }> {
    const timestamp = Date.now().toString();
    const path = `/orders/${orderId}`;
    const method = 'DELETE';

    try {
        const signature = await createSignature(
            credentials.secret,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.POLYMARKET_CLOB}${path}`, {
            method,
            headers: {
                'POLY-API-KEY': credentials.apiKey,
                'POLY-SIGNATURE': signature,
                'POLY-TIMESTAMP': timestamp,
                'POLY-PASSPHRASE': credentials.passphrase,
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
 * Get open orders for the user
 */
export async function getOpenOrders(
    credentials: PolymarketCredentials
): Promise<{ orders: unknown[]; error?: string }> {
    const timestamp = Date.now().toString();
    const path = '/orders';
    const method = 'GET';

    try {
        const signature = await createSignature(
            credentials.secret,
            timestamp,
            method,
            path
        );

        const response = await fetch(`${API_ENDPOINTS.POLYMARKET_CLOB}${path}`, {
            method,
            headers: {
                'POLY-API-KEY': credentials.apiKey,
                'POLY-SIGNATURE': signature,
                'POLY-TIMESTAMP': timestamp,
                'POLY-PASSPHRASE': credentials.passphrase,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            return { orders: [], error };
        }

        const data = await response.json();
        return { orders: data.orders || [] };
    } catch (error) {
        return {
            orders: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
