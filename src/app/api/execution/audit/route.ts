import { NextResponse } from 'next/server';
import { getAuditTrail, getExecutionHistory } from '@/lib/execution/audit';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const executionId = searchParams.get('executionId');
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        // Single execution trail
        if (executionId) {
            const trail = getAuditTrail(executionId);
            if (!trail) {
                return NextResponse.json(
                    { error: `No audit trail found for execution ${executionId}` },
                    { status: 404 }
                );
            }
            return NextResponse.json(trail);
        }

        // Full history
        const history = getExecutionHistory(limit);
        return NextResponse.json({
            executions: history,
            count: history.length,
        });
    } catch (error) {
        console.error('Audit trail fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch execution audit trail' },
            { status: 500 }
        );
    }
}
