import { createClient } from '@/lib/supabase/client'
import { criarUploadComprovante, confirmarComprovanteArquivo } from '@/app/historico/actions'

export async function enviarComprovante(historicoId: string, file: File) {
  const { path, token } = await criarUploadComprovante(historicoId, file.name, file.size)

  const supabase = createClient()
  const { error } = await supabase.storage
    .from('comprovantes')
    .uploadToSignedUrl(path, token, file, { contentType: 'application/pdf' })
  if (error) throw new Error('Erro ao enviar o arquivo.')

  await confirmarComprovanteArquivo(historicoId, path, file.name, file.size)
}
