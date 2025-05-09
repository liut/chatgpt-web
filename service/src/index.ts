import express from 'express'
import cookieParser from 'cookie-parser'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth, cookieName } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'
import { router as authRouter } from './auth'

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())
app.use(cookieParser())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

interface StreamMessage {
  id: string
  csid?: string
  pmid?: string
  delta: string
  text?: string
  finishReason?: string
}

const writeServerSendEvent = (res, data, eid?) => {
  if (eid)
    res.write(`id: ${eid}\n`)

  res.write(`data: ${data}\n\n`)
}

router.post('/chat-sse', [auth, limiter], async (req, res) => {
  const { csid, prompt, options = {}, systemMessage } = req.body as RequestProps
  const headers: { [key: string]: string } = {
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': '*',
  }
  let ncsid: string = csid
  if (!csid) {
    ncsid = (Date.now()).toString(36)
    headers['Conversation-ID'] = ncsid
  }

  res.writeHead(200, headers)

  try {
    options.conversationId = ncsid
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        const message: StreamMessage = {
          id: chat.id,
          csid: chat.conversationId || csid || ncsid,
          pmid: chat.parentMessageId,
          delta: chat.delta,
          // The other fields are not needed at the moment.
        }
        if (!chat.delta && chat.text)
          message.text = chat.text

        if (chat.detail && chat.detail.choices.length > 0 && chat.detail.choices[0].finish_reason)
          message.finishReason = chat.detail.choices[0].finish_reason

        writeServerSendEvent(res, JSON.stringify(message))
      },
      systemMessage,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

// Deprecated: by /chat-sse
router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {}, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.get('/session', async (req, res) => {
  try {
    const user = req.cookies[cookieName]
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY) // TODO: option for oauth
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel(), user } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.use('/api/auth', authRouter)
app.set('trust proxy', 1)

const port = process.env.SERVICE_PORT || 3002
app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
