import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const data = await request.json();
        
        // 打印接收到的完整数据
        console.log('=== API Route Received Data ===');
        console.log(JSON.stringify(data, null, 2));
        console.log('=============================');

        const response = await fetch('http://47.95.236.222:2019/pom/operate/create/xpath/', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'content-type': 'application/x-www-form-urlencoded',
                'priority': 'u=1, i',
                'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
              },

            body: new URLSearchParams(data).toString(),
            // JSON.stringify(data),
            
            // console.log('Submitting data:', JSON.stringify(formData, null, 2));
        });

        const result = await response.json();

        // 打印服务器响应
        console.log('=== Server Response ===');
        console.log(JSON.stringify(result, null, 2));
        console.log('=====================');

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to submit xpath' },
            { status: 500 }
        );
    }
}