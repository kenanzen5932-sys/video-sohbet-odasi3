import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the remote resource
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(url).origin + '/',
        'Origin': new URL(url).origin,
      },
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const isM3U8 = url.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')

    if (isM3U8) {
      let text = await response.text()

      // Rewrite relative URLs in the m3u8 to absolute URLs
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1)
      text = text.replace(/^(?!#)(?!https?:\/\/)(.+)$/gm, (match) => {
        if (match.trim() === '') return match
        return baseUrl + match
      })

      return new Response(text, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
        },
      })
    }

    // For .ts segments, stream the binary data
    const body = await response.arrayBuffer()
    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
