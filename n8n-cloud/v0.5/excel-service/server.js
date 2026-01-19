const express = require('express');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const app = express();

// 정적 파일 서빙
app.use(express.static('public'));

// JSON 파싱 (대용량 파일 지원)
app.use(express.json({ limit: '50mb' }));

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Excel 생성 API
app.post('/generate-excel', async (req, res) => {
    try {
        const { originalFileBase64, sdrData, clientName } = req.body;
        
        if (!originalFileBase64 || !sdrData || !clientName) {
            return res.status(400).json({ 
                error: 'Missing required fields: originalFileBase64, sdrData, clientName' 
            });
        }
        
        console.log(`📝 Processing Excel for "${clientName}"...`);
        console.log(`   eVars: ${sdrData.evars?.length || 0}`);
        console.log(`   Props: ${sdrData.props?.length || 0}`);
        console.log(`   Events: ${sdrData.events?.length || 0}`);
        console.log('\n📦 Received JSON Response:');
        console.log(JSON.stringify(sdrData, null, 2));
        
        // 원본 파일 로드
        const buffer = Buffer.from(originalFileBase64, 'base64');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        console.log(`   Loaded workbook with ${workbook.worksheets.length} sheets`);
        console.log(`   Sheet names: ${workbook.worksheets.map(ws => ws.name).join(', ')}`);
        
        // eVars 시트 작성
        if (sdrData.evars && sdrData.evars.length > 0) {
            const wsEvars = workbook.getWorksheet('eVars');
            if (wsEvars) {
                clearDataRows(wsEvars, 7);
                sdrData.evars.forEach((evar, index) => {
                    const row = wsEvars.getRow(7 + index);
                    row.getCell(2).value = evar['Requirement ID'] || '';
                    row.getCell(3).value = evar['Analytics Variable'] || '';
                    row.getCell(4).value = evar['Variable Name'] || '';
                    row.getCell(5).value = evar['Variable Description'] || '';
                    row.getCell(6).value = evar['Value Format'] || '';
                    row.getCell(7).value = evar['Example Value'] || '';
                    row.getCell(8).value = evar['eVar Allocation'] || '';
                    row.getCell(9).value = evar['eVar Expiration'] || '';
                    row.commit();
                });
                console.log(`   ✅ Wrote ${sdrData.evars.length} eVars to sheet`);
            } else {
                console.warn(`   ⚠️  eVars sheet not found in workbook`);
            }
        }
        
        // Props 시트 작성
        if (sdrData.props && sdrData.props.length > 0) {
            const wsProps = workbook.getWorksheet('props');
            if (wsProps) {
                clearDataRows(wsProps, 7);
                sdrData.props.forEach((prop, index) => {
                    const row = wsProps.getRow(7 + index);
                    row.getCell(2).value = prop['Requirement ID'] || '';
                    row.getCell(3).value = prop['Analytics Variable'] || '';
                    row.getCell(4).value = prop['Variable Name'] || '';
                    row.getCell(5).value = prop['Variable Description'] || '';
                    row.getCell(6).value = prop['Value Format'] || '';
                    row.getCell(7).value = prop['Example Value'] || '';
                    row.getCell(8).value = prop['Additional Notes'] || '';
                    row.getCell(9).value = '';
                    row.commit();
                });
                console.log(`   ✅ Wrote ${sdrData.props.length} Props to sheet`);
            } else {
                console.warn(`   ⚠️  Props sheet not found in workbook`);
            }
        }
        
        // Events 시트 작성
        if (sdrData.events && sdrData.events.length > 0) {
            const wsEvents = workbook.getWorksheet('custom events (metrics)');
            if (wsEvents) {
                clearDataRows(wsEvents, 7);
                sdrData.events.forEach((event, index) => {
                    const row = wsEvents.getRow(7 + index);
                    row.getCell(2).value = event['Requirement ID'] || '';
                    row.getCell(3).value = event['Event'] || '';
                    row.getCell(4).value = event['Event Name'] || '';
                    row.getCell(5).value = event['Event Description'] || '';
                    row.getCell(6).value = event['Event Type'] || '';
                    row.getCell(7).value = '';
                    row.getCell(8).value = '';
                    row.getCell(9).value = '';
                    row.commit();
                });
                console.log(`   ✅ Wrote ${sdrData.events.length} Events to sheet`);
            } else {
                console.warn(`   ⚠️  Events sheet not found in workbook`);
            }
        }
        
        // Excel 생성
        const outputBuffer = await workbook.xlsx.writeBuffer();
        
        // 파일명 생성 (연월일시분 포맷)
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/T/, '_')
            .replace(/:/g, '')
            .replace(/\.\d+Z$/, '')
            .substring(0, 15); // YYYY-MM-DD_HHmm
        const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `SDR_${safeClientName}_${timestamp}.xlsx`;
        
        // output 디렉토리 확인 및 생성
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`   📁 Created output directory: ${outputDir}`);
        }
        
        // 파일 저장
        const outputPath = path.join(outputDir, filename);
        await workbook.xlsx.writeFile(outputPath);
        console.log(`   💾 Saved to: ${outputPath}`);
        
        // 다운로드 응답
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(outputBuffer);
        
        console.log(`✅ Excel generated successfully: ${filename}`);
        console.log(`   File size: ${(outputBuffer.length / 1024).toFixed(2)} KB`);
    } catch (error) {
        console.error('❌ Error generating Excel:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper: 데이터 행 클리어 (Row 7부터)
function clearDataRows(worksheet, startRow) {
    const maxRow = worksheet.rowCount;
    for (let i = startRow; i <= maxRow; i++) {
        const row = worksheet.getRow(i);
        for (let j = 2; j <= 9; j++) {  // B~I 열 (2~9)
            row.getCell(j).value = null;
        }
        row.commit();
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'excel-generator',
        version: '0.5.0',
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Adobe Excel Service v0.5 started');
    console.log('================================================');
    console.log(`   Web UI:  http://localhost:${PORT}/`);
    console.log(`   API:     http://localhost:${PORT}/generate-excel`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    console.log('================================================');
    console.log('');
});
