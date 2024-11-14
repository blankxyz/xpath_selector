import { NextResponse } from 'next/server';

// const BASE_URL = 'http://47.95.236.222:2019';

export async function POST(request: Request) {
    try {

        console.log('=== Generating Spider Code ===');
        const data = await request.json();

        console.log('Request Data:', JSON.stringify(data, null, 2));

        const response = await fetch('http://47.95.236.222:2019/pom/create/spider-code/', {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'account_code': data.account_code,
                'project_name': data.project_name,
            }).toString(),
        });

        const result = await response.json();
        console.log('Server Response:', JSON.stringify(result, null, 2));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Spider Code Generation Error:', error);
        return NextResponse.json(
            { error: '生成爬虫代码失败' },
            { status: 500 }
        );
    }
}