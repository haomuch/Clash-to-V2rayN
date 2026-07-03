export default {
  async fetch(request, env, ctx) {
    const sourceUrl = 'https://xxx.xxxx.xyz'; // <--在引号内填写原始Clash订阅链接地址
    
    try {
      // 1. 获取源站 YAML 订阅
      const response = await fetch(sourceUrl, {
        headers: {
          'User-Agent': 'clash-verge/v2.5.1'
        }
      });
      
      if (!response.ok) {
        return new Response('获取源站订阅失败', { status: 500 });
      }
      
      const yamlText = await response.text();
      const lines = yamlText.split('\n');
      const vlessLinks = [];

      // 2. 逐行解析并提取 VLESS 节点
      for (let line of lines) {
        // 仅处理包含 type: vless 的行
        if (line.includes('type: vless')) {
          
          // 提取各个字段的辅助函数
          const getVal = (regex) => {
            const m = line.match(regex);
            return m ? m[1].trim().replace(/['"]/g, '') : '';
          };

          const name = getVal(/name:\s*([^,{}]+)/);
          const server = getVal(/server:\s*([^,{}]+)/);
          const port = getVal(/port:\s*(\d+)/);
          const uuid = getVal(/uuid:\s*([^,{}]+)/);
          const flow = getVal(/flow:\s*([^,{}]+)/);
          const network = getVal(/network:\s*([^,{}]+)/) || 'tcp';
          const fp = getVal(/client-fingerprint:\s*([^,{}]+)/);
          
          // 核心逻辑：提取 servername，并将其赋值给 sni
          const servername = getVal(/servername:\s*([^,{}]+)/);
          const finalSni = servername; // 严格执行：将 sni 修改为 servername 的内容

          // 提取 Reality 特有字段 (public-key 和 short-id)
          const pbk = getVal(/public-key:\s*([^,{} ]+)/);
          const sid = getVal(/short-id:\s*([^,{} ]+)/);

          // 3. 构建 vless:// 链接
          // 格式: vless://uuid@server:port?query#name
          if (uuid && server && port) {
            let params = new URLSearchParams();
            params.append('security', 'reality');
            params.append('sni', finalSni);
            params.append('fp', fp || 'safari');
            params.append('pbk', pbk);
            params.append('sid', sid);
            params.append('type', network);
            params.append('flow', flow);

            const link = `vless://${uuid}@${server}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
            vlessLinks.push(link);
          }
        }
      }

      if (vlessLinks.length === 0) {
        return new Response('未提取到任何 VLESS 节点', { status: 404 });
      }

      // 4. 将所有转换后的节点合并并 Base64 编码
      const resultText = vlessLinks.join('\n');
      const finalBase64 = encodeBase64Safe(resultText);

      // 5. 输出结果
      return new Response(finalBase64, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (err) {
      return new Response(`处理失败: ${err.message}`, { status: 500 });
    }
  }
};

/**
 * 安全的 Base64 编码（支持 UTF-8 字符）
 */
function encodeBase64Safe(str) {
  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(str);
  let binaryString = '';
  for (let i = 0; i < encodedBytes.length; i++) {
    binaryString += String.fromCharCode(encodedBytes[i]);
  }
  return btoa(binaryString);
}
