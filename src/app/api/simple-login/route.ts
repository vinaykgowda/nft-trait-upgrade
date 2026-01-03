import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    
    // Just return success for testing
    return NextResponse.json({ 
      success: true,
      message: 'Simple login endpoint working',
      received: { username, password: '***' }
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple login endpoint - use POST method',
    status: 'available'
  });
}