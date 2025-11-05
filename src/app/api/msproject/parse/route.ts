// app/api/msproject/parse/route.ts
import { NextResponse } from 'next/server'
import { parseMSProjectXML, validateMSProjectXML } from '@/lib/msproject/parser'

export async function POST(request: Request) {
  try {
    const { xml } = await request.json()

    if (!xml) {
      return NextResponse.json(
        { error: 'XML não fornecido' },
        { status: 400 }
      )
    }

    // Validar XML
    const validation = validateMSProjectXML(xml)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Parse do XML
    const preview = await parseMSProjectXML(xml)

    return NextResponse.json(preview)
  } catch (error) {
    console.error('Erro ao processar XML:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Erro ao processar arquivo XML' 
      },
      { status: 500 }
    )
  }
}