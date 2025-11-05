// app/api/msproject/import/route.ts
import { NextResponse } from 'next/server'
import { parseMSProjectXML, validateMSProjectXML } from '@/lib/msproject/parser'
import { importMSProject } from '@/lib/msproject/importer'

export async function POST(request: Request) {
  try {
    const { xml, metadata } = await request.json()

    if (!xml) {
      return NextResponse.json(
        { error: 'XML não fornecido' },
        { status: 400 }
      )
    }

    if (!metadata || !metadata.category) {
      return NextResponse.json(
        { error: 'Categoria do projeto é obrigatória' },
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
    console.log('📋 Iniciando parse do XML...')
    const preview = await parseMSProjectXML(xml)

    // Importar para o banco
    console.log('💾 Iniciando importação para o banco...')
    const result = await importMSProject(
      preview.tasks,
      preview.project,
      metadata
    )

    console.log('✅ Importação concluída com sucesso!')
    console.log(`   - Projeto ID: ${result.projectId}`)
    console.log(`   - Tarefas: ${result.tasksCreated}`)
    console.log(`   - Predecessores: ${result.predecessorsCreated}`)

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      tasksCreated: result.tasksCreated,
      predecessorsCreated: result.predecessorsCreated
    })

  } catch (error) {
    console.error('❌ Erro ao importar projeto:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Erro ao importar projeto' 
      },
      { status: 500 }
    )
  }
}