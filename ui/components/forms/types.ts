export type FormMode = "create" | "edit" | "view"

export interface BaseFormModalProps<TData, TFormData = TData> {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: FormMode
  initialData?: TData | null
  loading?: boolean
  readOnly?: boolean
  onSubmit: (values: TFormData) => Promise<void>
  onCancel?: () => void
}
