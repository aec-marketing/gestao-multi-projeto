// lib/msproject/parser.ts
// Parser de XML do MS Project 2016

import { XMLParser } from 'fast-xml-parser'
import type { MSProjectTask, ImportPreview } from '@/types/database.types'

interface XMLTask {
  UID: number
  ID: number
  Name: string
  OutlineNumber: string
  OutlineLevel: number
  Start: string
  Finish: string
  Duration: string
  PercentComplete: number
  Summary: number
  Critical: number
  PredecessorLink?: {
    PredecessorUID: number
    Type: number
    LinkLag: number
  } | Array<{
    PredecessorUID: number
    Type: number
    LinkLag: number
  }>
}

interface XMLProject {
  Project: {
    Title: string
    StartDate: string
    FinishDate: string
    Tasks: {
      Task: XMLTask[]
    }
  }
}

/**
 * Parse da duração ISO 8601 para dias
 * Exemplo: PT88H0M0S → 11 dias (88h / 8h por dia)
 */
function parseDuration(isoDuration: string): number {
  if (!isoDuration) return 0
  
  const hourMatch = isoDuration.match(/PT(\d+)H/)
  if (!hourMatch) return 0
  
  const hours = parseInt(hourMatch[1])
  return Math.ceil(hours / 8) // 8 horas por dia útil
}

/**
 * Mapeia tipo de predecessor do MS Project para nosso enum
 * 0 = FF (Fim-Fim)
 * 1 = FS (Fim-Início) - padrão
 * 2 = SF (Início-Fim)
 * 3 = SS (Início-Início)
 */
function mapPredecessorType(type: number): 'FF' | 'FS' | 'SF' | 'SS' {
  const map: Record<number, 'FF' | 'FS' | 'SF' | 'SS'> = {
    0: 'FF',
    1: 'FS',
    2: 'SF',
    3: 'SS'
  }
  return map[type] || 'FS'
}

/**
 * Converte lag de minutos para dias
 * MS Project armazena lag em minutos (480 = 1 dia)
 */
function lagMinutesToDays(minutes: number): number {
  if (!minutes) return 0
  return Math.round(minutes / 480) // 480 minutos = 8 horas = 1 dia
}

/**
 * Extrai código e nome do projeto
 * Exemplo: "[AC10189500-R00] RETROFIT HOT STRIPPING"
 * → code: "AC10189500-R00", name: "RETROFIT HOT STRIPPING"
 */
function extractProjectInfo(title: string): { code: string; name: string } {
  const match = title.match(/^\[([^\]]+)\]\s*(.+)$/)
  
  if (match) {
    return {
      code: match[1].trim(),
      name: match[2].trim()
    }
  }
  
  // Se não tiver formato [CÓDIGO] NOME, usa título completo como nome
  return {
    code: title.substring(0, 20), // Primeiros 20 chars como código
    name: title
  }
}

/**
 * Parse do arquivo XML do MS Project
 */
export async function parseMSProjectXML(xmlContent: string): Promise<ImportPreview> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'n',
    parseTagValue: true,
    trimValues: true
  })

  const parsed: XMLProject = parser.parse(xmlContent)
  const project = parsed.Project
  const xmlTasks = Array.isArray(project.Tasks.Task) 
    ? project.Tasks.Task 
    : [project.Tasks.Task]

  // Task UID=0 é sempre o projeto inteiro (ignorar nas tarefas)
  const projectTask = xmlTasks.find(t => t.UID === 0)
  const tasks = xmlTasks.filter(t => t.UID !== 0)

  if (!projectTask) {
    throw new Error('XML inválido: Task UID=0 (projeto) não encontrada')
  }

  // Extrair info do projeto
  const { code, name } = extractProjectInfo(projectTask.Name || project.Title)
  // Usar datas da Task UID=0 (projeto) que são as datas reais
  const startDate = new Date(projectTask.Start || project.StartDate)
  const endDate = new Date(projectTask.Finish || project.FinishDate)

  // Converter tarefas XML para nosso formato
  const convertedTasks: MSProjectTask[] = tasks.map(xmlTask => {
    // Processar predecessores (pode ser objeto único ou array)
    let predecessors: MSProjectTask['predecessors'] = []
    
    if (xmlTask.PredecessorLink) {
      const links = Array.isArray(xmlTask.PredecessorLink)
        ? xmlTask.PredecessorLink
        : [xmlTask.PredecessorLink]
      
      predecessors = links.map(link => ({
        uid: link.PredecessorUID,
        type: mapPredecessorType(link.Type),
        lag: lagMinutesToDays(link.LinkLag || 0)
      }))
    }

    return {
      uid: xmlTask.UID,
      name: xmlTask.Name,
      outlineNumber: String(xmlTask.OutlineNumber), // Garantir que é string
      outlineLevel: xmlTask.OutlineLevel,
      start: new Date(xmlTask.Start),
      finish: new Date(xmlTask.Finish),
      duration: parseDuration(xmlTask.Duration),
      percentComplete: xmlTask.PercentComplete || 0,
      isSummary: xmlTask.Summary === 1,
      isCritical: xmlTask.Critical === 1,
      predecessors
    }
  })

  // Calcular estatísticas
  const stats = {
    level1Tasks: convertedTasks.filter(t => t.outlineLevel === 1).length,
    level2Tasks: convertedTasks.filter(t => t.outlineLevel === 2).length,
    level3PlusTasks: convertedTasks.filter(t => t.outlineLevel >= 3).length,
    tasksWithPredecessors: convertedTasks.filter(t => t.predecessors.length > 0).length,
    completedTasks: convertedTasks.filter(t => t.percentComplete === 100).length,
    summaryTasks: convertedTasks.filter(t => t.isSummary).length,
    criticalTasks: convertedTasks.filter(t => t.isCritical).length
  }

  return {
    project: {
      code,
      name,
      startDate,
      endDate,
      totalTasks: convertedTasks.length,
      totalDuration: parseDuration(projectTask.Duration)
    },
    tasks: convertedTasks,
    stats
  }
}

/**
 * Valida se o XML é de um MS Project válido
 */
export function validateMSProjectXML(xmlContent: string): { 
  valid: boolean
  error?: string 
} {
  try {
    if (!xmlContent.includes('<Project xmlns="http://schemas.microsoft.com/project">')) {
      return {
        valid: false,
        error: 'Arquivo não é um XML do MS Project válido'
      }
    }

    if (!xmlContent.includes('<Tasks>')) {
      return {
        valid: false,
        error: 'XML não contém tarefas'
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Erro ao validar XML: ${error}`
    }
  }
}