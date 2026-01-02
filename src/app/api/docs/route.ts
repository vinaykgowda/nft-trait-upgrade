import { NextRequest, NextResponse } from 'next/server';
import { generateOpenApiSpec, generateApiDocumentationHtml } from '@/lib/api/documentation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'html';

  try {
    if (format === 'json' || format === 'openapi') {
      const spec = generateOpenApiSpec();
      return NextResponse.json(spec);
    }

    if (format === 'html') {
      const html = generateApiDocumentationHtml();
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid format. Use ?format=html, ?format=json, or ?format=openapi' },
      { status: 400 }
    );
  } catch (error) {
    console.error('API documentation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate API documentation' },
      { status: 500 }
    );
  }
}