'use client'

import { getBuiltinVariables } from '@/lib/template/variable-resolver'
import { Button } from '@/components/ui/button'
import { Variable } from 'lucide-react'

interface TemplateVariablePickerProps {
  onInsert: (variable: string) => void
}

export function TemplateVariablePicker({ onInsert }: TemplateVariablePickerProps) {
  const variables = getBuiltinVariables()

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Variable className="h-3.5 w-3.5" />
        可用变量
      </div>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v.name}
            onClick={() => onInsert(`{{${v.name}}}`)}
            className="rounded-md bg-secondary px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary/80"
            title={v.description}
          >
            {'{{'}
            {v.name}
            {'}}'}
          </button>
        ))}
      </div>
    </div>
  )
}
