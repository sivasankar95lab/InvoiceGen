// pdfMake Configuration
// Uses default VFS fonts from vfs_fonts.js (Roboto)


const COLORS = {
    TAX: {
        primary: '#0d6efd', // Blue
        secondary: '#6c757d',
        bg: '#f8f9fa'
    },
    SIMPLE: {
        primary: '#198754', // Green
        secondary: '#6c757d',
        bg: '#f8f9fa'
    },
    CHALLAN: {
        primary: '#ffc107', // Yellow
        secondary: '#6c757d',
        bg: '#fff3cd'
    },
    QUOTE: {
        primary: '#0dcaf0', // Cyan
        secondary: '#6c757d',
        bg: '#e0faff'
    }
};

function buildHeader(data, title, color) {
    const leftStack = [];
    const showGst = title !== 'INVOICE' && title !== 'QUOTATION';

    // Propagate content for BILLED BY
    const billedByContent = [
        { text: 'BILLED BY', style: 'label', margin: [0, 0, 0, 2] },
        { text: checkEmpty(data.details.companyName), style: 'h3' },
        { text: checkEmpty(data.details.companyAddress), style: 'normal' },
        data.details.companyPhone ? { text: 'Ph: ' + data.details.companyPhone, style: 'normal' } : {},
        (showGst && data.details.companyGst) ? { text: 'GSTIN: ' + checkEmpty(data.details.companyGst), style: 'normal', color: color } : {}
    ];

    // Logo & Billed By Layout
    if (data.details.logo) {
        leftStack.push({
            columns: [
                {
                    image: data.details.logo,
                    width: 70,
                    margin: [0, 0, 15, 0]
                },
                {
                    stack: billedByContent,
                    width: '*'
                }
            ]
        });
    } else {
        leftStack.push({ stack: billedByContent });
    }

    // Spacer
    leftStack.push({ text: ' ', margin: [0, 5] });

    // Billed To & Invoice Details Layout
    const billedToContent = [
        { text: 'BILLED TO', style: 'label', margin: [0, 0, 0, 2] },
        { text: checkEmpty(data.details.clientName), style: 'h3' },
        { text: checkEmpty(data.details.clientAddress), style: 'normal' },
        data.details.clientPhone ? { text: 'Ph: ' + data.details.clientPhone, style: 'normal' } : {},
        (showGst && data.details.clientGst) ? { text: 'GSTIN: ' + checkEmpty(data.details.clientGst), style: 'normal', color: color } : {}
    ];

    let metaLabel = 'Invoice No:';
    if (title === 'QUOTATION') metaLabel = 'Quote No:';
    else if (title === 'DELIVERY CHALLAN') metaLabel = 'Challan No:';

    const metaContent = [
        { text: metaLabel, style: 'label', margin: [0, 0, 0, 2] },
        { text: data.details.invoiceNumber, bold: true, margin: [0, 0, 0, 5] },
        { text: 'Date:', style: 'label', margin: [0, 0, 0, 2] },
        { text: data.details.date, bold: true }
    ];

    leftStack.push({
        columns: [
            {
                stack: billedToContent,
                width: '*'
            },
            {
                stack: metaContent,
                width: 'auto',
                alignment: 'left' // Or right? User said "right of billed to", usually nice to align textual columns left relative to themselves, but maybe shift right? Left is safer for alignment with column.
            }
        ]
    });

    // QR Data Construction
    let qrData = '';
    const totalTax = (data.totals.cgst + data.totals.sgst + data.totals.igst).toFixed(2);

    // Base common info (Date and Document Number)
    const baseInfo = `Date: ${data.details.date}
${title}: ${data.details.invoiceNumber}`;

    if (title === 'TAX INVOICE') {
        const commonInfo = `${baseInfo}
From: ${data.details.companyName}${data.details.companyGst ? ', GST: ' + data.details.companyGst : ''}
To: ${data.details.clientName}${data.details.clientGst ? ', GST: ' + data.details.clientGst : ''}`;
        qrData = `${commonInfo}
Subtotal: ${data.totals.subtotal.toFixed(2)}
Discount: ${data.totals.discount.toFixed(2)}
Taxable Value: ${data.totals.taxableValue.toFixed(2)}
GST: ${totalTax}
Total: ${data.totals.total.toFixed(2)}`;
    } else if (title === 'INVOICE') {
        const commonInfoNoGst = `${baseInfo}
From: ${data.details.companyName}
To: ${data.details.clientName}`;
        qrData = `${commonInfoNoGst}
Subtotal: ${data.totals.subtotal.toFixed(2)}
Discount: ${data.totals.discount.toFixed(2)}
Total: ${(data.totals.subtotal - data.totals.discount).toFixed(2)}`;
    } else if (title === 'QUOTATION') {
        const commonInfoNoGst = `${baseInfo}
From: ${data.details.companyName}
To: ${data.details.clientName}`;
        qrData = `${commonInfoNoGst}
Total: ${data.totals.subtotal.toFixed(2)}
Disclaimer: The quoted amount does not yet include any applicable taxes.`;
    } else if (title === 'DELIVERY CHALLAN') {
        const challanFrom = `From: ${data.details.companyName}
Address: ${data.details.companyAddress}`;
        const challanTo = `To: ${data.details.clientName}
Address: ${data.details.clientAddress}`;
        const transportInfo = `Transport Mode: ${data.details.transportMode || 'N/A'}
Vehicle/Ref No: ${data.details.vehicleNumber || 'N/A'}`;
        const totalQty = data.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
        qrData = `${baseInfo}
${challanFrom}
${challanTo}
${transportInfo}
Total Quantity: ${totalQty}`;
    } else {
        qrData = baseInfo;
    }

    return [
        // Top Bar
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 5, color: color }] },
        { text: title, style: 'header', alignment: 'right', color: color, margin: [0, 10, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: color }] },

        // Header Columns
        {
            margin: [0, 10, 0, 10],
            columns: [
                {
                    width: '65%',
                    stack: leftStack
                },
                {
                    width: '35%',
                    stack: [
                        { qr: qrData, fit: 120, alignment: 'right' }
                    ],
                    alignment: 'right'
                }
            ]
        }
    ];
}

function buildFooter(data, color) {
    return [
        // Signature & Footer
        {
            margin: [0, 15, 0, 0],
            columns: [
                { width: '*', text: '' },
                {
                    width: 150,
                    stack: [
                        data.details.signature ? { image: data.details.signature, width: 100, alignment: 'right' } : {},
                        { text: 'Authorized Signatory', alignment: 'right', margin: [0, 5, 0, 0], fontSize: 10, bold: true }
                    ]
                }
            ]
        },

        // Footer Brand
        {
            margin: [0, 15, 0, 0],
            text: 'Thank you for your business!',
            alignment: 'center',
            color: color,
            italics: true,
            fontSize: 10
        }
    ];
}

function generateTaxInvoice(data, returnDoc = false) {
    try {
        const C = COLORS.TAX;
        const docDefinition = {
            background: getWatermarkBackground(data.details.logo),
            content: [
                ...buildHeader(data, 'TAX INVOICE', C.primary),


                // Table
                {
                    table: {
                        headerRows: 1,
                        widths: (() => {
                            const base = ['*', 'auto', 'auto', 'auto', 'auto']; // Item, Qty, Rate, Tax, Amount
                            if (data.items.some(i => i.hsn)) base.splice(1, 0, 'auto');
                            return base;
                        })(),
                        body: [
                            (() => {
                                const headers = [
                                    { text: 'Item Description', style: 'tableHeader', fillColor: C.primary },
                                    { text: 'Qty', style: 'tableHeader', fillColor: C.primary },
                                    { text: 'Rate', style: 'tableHeader', fillColor: C.primary },
                                    { text: data.details.taxType === 'Same State' ? 'GST' : 'IGST', style: 'tableHeader', fillColor: C.primary },
                                    { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: C.primary }
                                ];
                                if (data.items.some(i => i.hsn)) {
                                    headers.splice(1, 0, { text: 'HSN', style: 'tableHeader', fillColor: C.primary });
                                }
                                return headers;
                            })(),
                            ...data.items.map((item, i) => {
                                const taxable = item.qty * item.rate;
                                const taxAmt = taxable * (item.gst / 100);
                                const total = taxable + taxAmt;
                                const fill = i % 2 === 0 ? '#fff' : C.bg;

                                const row = [
                                    { text: item.name, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: item.qty, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: '₹ ' + item.rate.toFixed(2), fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: item.gst + '%', fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: '₹ ' + total.toFixed(2), alignment: 'right', fillColor: fill, margin: [5, 4, 5, 4] }
                                ];

                                if (data.items.some(i => i.hsn)) {
                                    row.splice(1, 0, { text: item.hsn, fillColor: fill, margin: [5, 8, 5, 8] });
                                }
                                return row;
                            })
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 1; },
                        vLineWidth: function (i, node) { return 1; },
                        hLineColor: function (i, node) { return '#eaeaea'; },
                        vLineColor: function (i, node) { return '#eaeaea'; }
                    }
                },

                // Amount in Words
                {
                    margin: [0, 10, 0, 0],
                    text: [
                        { text: 'Amount in Words:\n', style: 'label' },
                        { text: data.numberInWords, style: 'normal', italics: true }
                    ]
                },

                // Payment & Totals Section
                {
                    margin: [0, 20, 0, 0],
                    columns: [
                        // Payment Details & QR
                        {
                            width: '*',
                            stack: [
                                (data.details.bankName || data.details.upiId) ? { text: 'Payment Details:', style: 'h3', fontSize: 11, margin: [0, 0, 0, 5] } : {},
                                data.details.bankName ? {
                                    table: {
                                        body: [
                                            [{ text: 'Account Name:', style: 'label', width: 60 }, { text: data.details.accountName, style: 'normal', bold: true }],
                                            [{ text: 'Bank:', style: 'label' }, { text: data.details.bankName, style: 'normal', bold: true }],
                                            [{ text: 'A/C No:', style: 'label' }, { text: data.details.accountNumber, style: 'normal' }],
                                            [{ text: 'IFSC:', style: 'label' }, { text: data.details.ifscCode, style: 'normal' }]
                                        ]
                                    },
                                    layout: 'noBorders',
                                    margin: [0, 0, 0, 10]
                                } : {},
                                data.details.upiId ? {
                                    stack: [
                                        { qr: `upi://pay?pa=${data.details.upiId}&pn=${data.details.companyName}&am=${data.totals.total}&cu=INR`, fit: 70 },
                                        { text: 'Scan to Pay', style: 'label', margin: [0, 5, 0, 0] },
                                        { text: data.details.upiId, style: 'normal', fontSize: 9 }
                                    ]
                                } : {}
                            ]
                        },
                        // Totals
                        {
                            width: 'auto',
                            table: {
                                widths: [100, 80],
                                body: [
                                    ['Subtotal', { text: '₹ ' + data.totals.subtotal.toFixed(2), alignment: 'right' }],
                                    (data.totals.discount > 0) ? ['Discount', { text: '- ₹ ' + data.totals.discount.toFixed(2), alignment: 'right', color: 'red' }] : [],
                                    (data.totals.discount > 0) ? [{ text: 'Taxable Value', bold: true }, { text: '₹ ' + data.totals.taxableValue.toFixed(2), alignment: 'right', bold: true }] : [],
                                    ...getTaxRows(data),
                                    [{ text: 'Total', bold: true, fontSize: 12, color: C.primary }, { text: '₹ ' + data.totals.total.toFixed(2), bold: true, fontSize: 12, alignment: 'right', color: C.primary }]
                                ].filter(row => row.length > 0)
                            },
                            layout: 'noBorders'
                        }
                    ]
                },
                buildNote(data),
                ...buildFooter(data, C.primary)
            ],
            styles: getStyles()
        };
        if (returnDoc) return docDefinition;
        pdfMake.createPdf(docDefinition).download(`Invoice_${data.details.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (window.ErrorLogger) window.ErrorLogger.log({ type: 'PDF Generation Error', message: error.message, stack: error.stack });
        if (window.NotificationManager) window.NotificationManager.alert("Failed to generate PDF. Please check error logs.", "Error", "error");
    }
}

function generateSimpleInvoice(data, returnDoc = false) {
    try {
        const C = COLORS.SIMPLE;
        const docDefinition = {
            background: getWatermarkBackground(data.details.logo),
            content: [
                ...buildHeader(data, 'INVOICE', C.primary),

                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Item', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Qty', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Rate', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: C.primary }
                            ],
                            ...data.items.map((item, i) => {
                                const taxable = item.qty * item.rate;
                                // Simple Invoice: Amount = Qty * Rate (No Tax)
                                const fill = i % 2 === 0 ? '#fff' : C.bg;
                                return [
                                    { text: item.name, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: item.qty, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: '₹ ' + item.rate.toFixed(2), fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: '₹ ' + taxable.toFixed(2), alignment: 'right', fillColor: fill, margin: [5, 4, 5, 4] }
                                ];
                            })
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 1; },
                        vLineWidth: function (i, node) { return 1; },
                        hLineColor: function (i, node) { return '#eaeaea'; },
                        vLineColor: function (i, node) { return '#eaeaea'; }
                    }
                },

                // Amount in Words
                {
                    margin: [0, 10, 0, 0],
                    text: [
                        { text: 'Amount in Words:\n', style: 'label' },
                        { text: data.numberInWordsSimple || data.numberInWords, style: 'normal', italics: true }
                    ]
                },

                // Payment & Totals Section
                {
                    margin: [0, 20, 0, 0],
                    columns: [
                        // Payment Details & QR
                        {
                            width: '*',
                            stack: [
                                (data.details.bankName || data.details.upiId) ? { text: 'Payment Details:', style: 'h3', fontSize: 11, margin: [0, 0, 0, 5] } : {},
                                data.details.bankName ? {
                                    table: {
                                        body: [
                                            [{ text: 'Account Name:', style: 'label', width: 60 }, { text: data.details.accountName, style: 'normal', bold: true }],
                                            [{ text: 'Bank:', style: 'label' }, { text: data.details.bankName, style: 'normal', bold: true }],
                                            [{ text: 'A/C No:', style: 'label' }, { text: data.details.accountNumber, style: 'normal' }],
                                            [{ text: 'IFSC:', style: 'label' }, { text: data.details.ifscCode, style: 'normal' }]
                                        ]
                                    },
                                    layout: 'noBorders',
                                    margin: [0, 0, 0, 10]
                                } : {},
                                data.details.upiId ? {
                                    stack: [
                                        { qr: `upi://pay?pa=${data.details.upiId}&pn=${data.details.companyName}&am=${(data.totals.subtotal - data.totals.discount).toFixed(2)}&cu=INR`, fit: 70 },
                                        { text: 'Scan to Pay', style: 'label', margin: [0, 5, 0, 0] },
                                        { text: data.details.upiId, style: 'normal', fontSize: 9 }
                                    ]
                                } : {}
                            ]
                        },
                        {
                            width: 'auto',
                            alignment: 'right',
                            text: [
                                { text: `Subtotal: ₹ ${data.totals.subtotal.toFixed(2)}\n`, margin: [0, 0, 0, 2] },
                                (data.totals.discount > 0) ? { text: `Discount: - ₹ ${data.totals.discount.toFixed(2)}\n`, color: 'red', margin: [0, 0, 0, 5] } : '',
                                { text: 'Total: ', bold: true, color: C.primary },
                                { text: '₹ ' + (data.totals.subtotal - data.totals.discount).toFixed(2), bold: true, fontSize: 14, color: C.primary }
                            ]
                        }
                    ]
                },
                buildNote(data),
                ...buildFooter(data, C.primary)
            ],
            styles: getStyles()
        };
        if (returnDoc) return docDefinition;
        pdfMake.createPdf(docDefinition).download(`Invoice_${data.details.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (window.ErrorLogger) window.ErrorLogger.log({ type: 'PDF Generation Error', message: error.message, stack: error.stack });
        if (window.NotificationManager) window.NotificationManager.alert("Failed to generate PDF. Please check error logs.", "Error", "error");
    }
}

function generateDeliveryChallan(data, returnDoc = false) {
    try {
        const C = COLORS.CHALLAN;
        const docDefinition = {
            background: getWatermarkBackground(data.details.logo),
            content: [
                ...buildHeader(data, 'DELIVERY CHALLAN', '#d39e00'), // Use darker yellow for text
                { text: '(Not for Sale)', style: 'label', alignment: 'right', margin: [0, -10, 0, 20] },

                // Transport Info (Challan Specific)
                (data.details.transportMode || data.details.vehicleNumber) ? {
                    margin: [0, 0, 0, 10],
                    table: {
                        widths: ['*', '*'],
                        body: [
                            [
                                { text: 'Transport Mode', style: 'label', fillColor: '#fff3cd' },
                                { text: 'Vehicle/Ref Number', style: 'label', fillColor: '#fff3cd' }
                            ],
                            [
                                { text: checkEmpty(data.details.transportMode), style: 'h3' },
                                { text: checkEmpty(data.details.vehicleNumber), style: 'h3' }
                            ]
                        ]
                    },
                    layout: 'noBorders'
                } : {},
                {
                    table: {
                        headerRows: 1,
                        widths: (() => {
                            const base = ['*', 'auto']; // Item, Qty
                            if (data.items.some(i => i.hsn)) base.splice(1, 0, 'auto');
                            return base;
                        })(),
                        body: [
                            (() => {
                                const headers = [
                                    { text: 'Item Description', style: 'tableHeader', fillColor: C.primary, color: 'black' },
                                    { text: 'Quantity', style: 'tableHeader', alignment: 'right', fillColor: C.primary, color: 'black' }
                                ];
                                if (data.items.some(i => i.hsn)) {
                                    headers.splice(1, 0, { text: 'HSN', style: 'tableHeader', fillColor: C.primary, color: 'black' });
                                }
                                return headers;
                            })(),
                            ...data.items.map((item, i) => {
                                const fill = i % 2 === 0 ? '#fff' : C.bg;
                                const row = [
                                    { text: item.name, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: item.qty, alignment: 'right', fillColor: fill, margin: [5, 4, 5, 4] }
                                ];
                                if (data.items.some(i => i.hsn)) {
                                    row.splice(1, 0, { text: item.hsn, fillColor: fill, margin: [5, 4, 5, 4] });
                                }
                                return row;
                            }),
                            // Total Quantity Row
                            [
                                {
                                    text: 'Total Quantity',
                                    bold: true,
                                    alignment: 'right',
                                    colSpan: data.items.some(i => i.hsn) ? 2 : 1,
                                    margin: [5, 5, 5, 5]
                                },
                                ...(data.items.some(i => i.hsn) ? [{}] : []),
                                {
                                    text: data.items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0),
                                    bold: true,
                                    alignment: 'right',
                                    margin: [5, 5, 5, 5]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 1; },
                        vLineWidth: function (i, node) { return 1; },
                        hLineColor: function (i, node) { return '#eaeaea'; },
                        vLineColor: function (i, node) { return '#eaeaea'; }
                    }
                },
                buildNote(data),
                // Signatures Section (Combined)
                {
                    margin: [0, 40, 0, 0],
                    columns: [
                        // Receiver Signature (Left)
                        {
                            width: 150,
                            stack: [
                                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 1 }] },
                                { text: "Receiver's Signature", style: 'label', margin: [0, 5, 0, 0] }
                            ]
                        },
                        { width: '*', text: '' },
                        // Authorized Signatory (Right)
                        {
                            width: 150,
                            stack: [
                                data.details.signature ? { image: data.details.signature, width: 100, alignment: 'right' } : {},
                                { text: 'Authorized Signatory', alignment: 'right', margin: [0, 5, 0, 0], fontSize: 10, bold: true }
                            ]
                        }
                    ]
                },

                // Footer Brand
                {
                    margin: [0, 30, 0, 0],
                    text: 'Thank you for your business!',
                    alignment: 'center',
                    color: '#d39e00',
                    italics: true,
                }
            ],
            styles: getStyles()
        };
        if (returnDoc) return docDefinition;
        pdfMake.createPdf(docDefinition).download(`Challan_${data.details.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (window.ErrorLogger) window.ErrorLogger.log({ type: 'PDF Generation Error', message: error.message, stack: error.stack });
        if (window.NotificationManager) window.NotificationManager.alert("Failed to generate PDF. Please check error logs.", "Error", "error");
    }
}

function generateQuote(data, returnDoc = false) {
    try {
        const C = COLORS.QUOTE;
        const docDefinition = {
            content: [
                ...buildHeader(data, 'QUOTATION', C.primary),



                // Item Table (Reusing Simple Style or Tax Style? Let's use Tax Style layout but different colors)
                // Actually, Quotes often look like Tax Invoices but without the Tax Invoice title.
                // Let's use a unified approach: Use the custom table builder if possible, or manually build it.
                // For simplicity/consistency, I'll copy the Tax Invoice structure but change the header.



                // Table
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'], // Description, Qty, Rate, Amount
                        body: [
                            [
                                { text: 'Item Description', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Qty', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Rate', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: C.primary }
                            ],
                            ...data.items.map((item, i) => {
                                const total = item.qty * item.rate;
                                const fill = i % 2 === 0 ? '#fff' : C.bg;
                                return [
                                    { text: item.name, fillColor: fill, margin: [5, 8, 5, 8] },
                                    { text: item.qty, fillColor: fill, margin: [5, 8, 5, 8] },
                                    { text: '₹ ' + item.rate.toFixed(2), fillColor: fill, margin: [5, 8, 5, 8] },
                                    { text: '₹ ' + total.toFixed(2), alignment: 'right', fillColor: fill, margin: [5, 8, 5, 8] }
                                ];
                            })
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 1; },
                        vLineWidth: function (i, node) { return 1; },
                        hLineColor: function (i, node) { return '#eaeaea'; },
                        vLineColor: function (i, node) { return '#eaeaea'; }
                    }
                },

                // Amount in Words
                {
                    margin: [0, 10, 0, 0],
                    text: [
                        { text: 'Amount in Words: ', bold: true, fontSize: 10 },
                        { text: data.numberInWordsSimple, italics: true, fontSize: 10 } // Use Simple (no tax) words
                    ]
                },

                // Payment & Totals Section
                {
                    margin: [0, 20, 0, 0],
                    columns: [
                        // Payment Details
                        {
                            width: '*',
                            stack: [
                                (data.details.bankName || data.details.upiId) ? { text: 'Payment Details:', style: 'h3', fontSize: 11, margin: [0, 0, 0, 5] } : {},
                                (() => {
                                    const rows = [];
                                    if (data.details.bankName) {
                                        rows.push([{ text: 'Account Name:', style: 'label', width: 60 }, { text: data.details.accountName, style: 'normal', bold: true }]);
                                        rows.push([{ text: 'Bank:', style: 'label' }, { text: data.details.bankName, style: 'normal', bold: true }]);
                                        rows.push([{ text: 'A/C No:', style: 'label' }, { text: data.details.accountNumber, style: 'normal' }]);
                                        rows.push([{ text: 'IFSC:', style: 'label' }, { text: data.details.ifscCode, style: 'normal' }]);
                                    }
                                    if (data.details.upiId) {
                                        rows.push([{ text: 'UPI ID:', style: 'label' }, { text: data.details.upiId, style: 'normal', bold: true }]);
                                    }
                                    if (rows.length > 0) {
                                        return {
                                            table: {
                                                body: rows
                                            },
                                            layout: 'noBorders',
                                            margin: [0, 0, 0, 10]
                                        };
                                    }
                                    return {};
                                })()
                            ]
                        },
                        {
                            width: 'auto',
                            table: {
                                widths: [100, 80],
                                body: [
                                    ['Total', { text: '₹ ' + data.totals.subtotal.toFixed(2), bold: true, fontSize: 12, alignment: 'right', color: C.primary }]
                                ]
                            },
                            layout: 'noBorders'
                        }
                    ]
                },

                // Disclaimer
                {
                    margin: [0, 5, 0, 0],
                    text: 'The quoted amount does not yet include any applicable taxes.',
                    italics: true,
                    fontSize: 12,
                    alignment: 'right',
                    color: '#666'
                },

                buildNote(data),
                ...buildFooter(data, C.primary)
            ],
            watermark: {
                text: 'QUOTATION',
                color: C.primary,
                opacity: 0.15,
                bold: true,
                italics: false,
                fontSize: 80,
                angle: 45
            },
            styles: getStyles()
        };
        if (returnDoc) return docDefinition;
        pdfMake.createPdf(docDefinition).download(`Quote_${data.details.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (window.ErrorLogger) window.ErrorLogger.log({ type: 'PDF Generation Error', message: error.message, stack: error.stack });
        if (window.NotificationManager) window.NotificationManager.alert("Failed to generate PDF. Please check error logs.", "Error", "error");
    }
}

function getStyles() {
    return {
        header: { fontSize: 22, bold: true },
        label: { fontSize: 9, color: '#999999', margin: [0, 0, 0, 2] },
        h3: { fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
        normal: { fontSize: 10, margin: [0, 0, 0, 2] },
        tableHeader: { bold: true, fontSize: 10, color: 'white', margin: [0, 3, 0, 3] }
    };
}

function buildNote(data) {
    if (!data.details.note) return {};
    return {
        margin: [0, 10, 0, 0],
        stack: [
            { text: 'Note:', style: 'label', bold: true },
            { text: data.details.note, style: 'normal', italics: true }
        ]
    };
}

function getTaxRows(data) {
    if (data.details.taxType === 'Same State') {
        return [
            ['CGST', { text: '₹ ' + data.totals.cgst.toFixed(2), alignment: 'right' }],
            ['SGST', { text: '₹ ' + data.totals.sgst.toFixed(2), alignment: 'right' }]
        ];
    } else {
        return [
            ['IGST', { text: '₹ ' + data.totals.igst.toFixed(2), alignment: 'right' }]
        ];
    }
}

function checkEmpty(str) {
    return str ? str : '';
}

function getWatermarkBackground(logo) {
    if (!logo) return null;
    return function (currentPage, pageSize) {
        // Center the logo (approximate centering since we don't know exact aspect ratio)
        // A4 width is ~595pt, height ~842pt.
        const width = 300;
        const x = (pageSize.width - width) / 2;
        const y = (pageSize.height - 300) / 2; // Assuming ~square or similar aspect ratio for centering

        return {
            image: logo,
            width: width,
            opacity: 0.05,
            absolutePosition: { x: x, y: y }
        };
    };
}

function generateCombinedInvoice(data, returnDoc = false) {
    try {
        const C = COLORS.SIMPLE;
        const docDefinition = {
            background: getWatermarkBackground(data.details.logo),
            content: [
                ...buildHeader(data, 'INVOICE', C.primary),

                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Item', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Qty', style: 'tableHeader', fillColor: C.primary },
                                { text: 'Amount', style: 'tableHeader', alignment: 'center', fillColor: C.primary }
                            ],
                            ...data.items.map((item, i) => {
                                const fill = i % 2 === 0 ? '#fff' : C.bg;
                                const row = [
                                    { text: item.name, fillColor: fill, margin: [5, 4, 5, 4] },
                                    { text: item.qty, fillColor: fill, margin: [5, 4, 5, 4] }
                                ];
                                if (i === 0) {
                                    const topMargin = 4 + (data.items.length - 1) * 10;
                                    row.push({
                                        text: '₹ ' + data.totals.subtotal.toFixed(2),
                                        alignment: 'center',
                                        verticalAlignment: 'middle',
                                        rowSpan: data.items.length,
                                        fillColor: '#fff',
                                        margin: [5, topMargin, 5, 4]
                                    });
                                } else {
                                    row.push({});
                                }
                                return row;
                            })
                        ]
                    },
                    layout: {
                        hLineWidth: function (i, node) { return 1; },
                        vLineWidth: function (i, node) { return 1; },
                        hLineColor: function (i, node) { return '#eaeaea'; },
                        vLineColor: function (i, node) { return '#eaeaea'; }
                    }
                },

                // Amount in Words
                {
                    margin: [0, 10, 0, 0],
                    text: [
                        { text: 'Amount in Words:\n', style: 'label' },
                        { text: data.numberInWordsSimple || data.numberInWords, style: 'normal', italics: true }
                    ]
                },

                // Payment & Totals Section
                {
                    margin: [0, 20, 0, 0],
                    columns: [
                        // Payment Details & QR
                        {
                            width: '*',
                            stack: [
                                (data.details.bankName || data.details.upiId) ? { text: 'Payment Details:', style: 'h3', fontSize: 11, margin: [0, 0, 0, 5] } : {},
                                data.details.bankName ? {
                                    table: {
                                        body: [
                                            [{ text: 'Account Name:', style: 'label', width: 60 }, { text: data.details.accountName, style: 'normal', bold: true }],
                                            [{ text: 'Bank:', style: 'label' }, { text: data.details.bankName, style: 'normal', bold: true }],
                                            [{ text: 'A/C No:', style: 'label' }, { text: data.details.accountNumber, style: 'normal' }],
                                            [{ text: 'IFSC:', style: 'label' }, { text: data.details.ifscCode, style: 'normal' }]
                                        ]
                                    },
                                    layout: 'noBorders',
                                    margin: [0, 0, 0, 10]
                                } : {},
                                data.details.upiId ? {
                                    stack: [
                                        { qr: `upi://pay?pa=${data.details.upiId}&pn=${data.details.companyName}&am=${(data.totals.subtotal - data.totals.discount).toFixed(2)}&cu=INR`, fit: 70 },
                                        { text: 'Scan to Pay', style: 'label', margin: [0, 5, 0, 0] },
                                        { text: data.details.upiId, style: 'normal', fontSize: 9 }
                                    ]
                                } : {}
                            ]
                        },
                        {
                            width: 'auto',
                            alignment: 'right',
                            text: [
                                { text: `Subtotal: ₹ ${data.totals.subtotal.toFixed(2)}\n`, margin: [0, 0, 0, 2] },
                                (data.totals.discount > 0) ? { text: `Discount: - ₹ ${data.totals.discount.toFixed(2)}\n`, color: 'red', margin: [0, 0, 0, 5] } : '',
                                { text: 'Total: ', bold: true, color: C.primary },
                                { text: '₹ ' + (data.totals.subtotal - data.totals.discount).toFixed(2), bold: true, fontSize: 14, color: C.primary }
                            ]
                        }
                    ]
                },
                buildNote(data),
                ...buildFooter(data, C.primary)
            ],
            styles: getStyles()
        };
        if (returnDoc) return docDefinition;
        pdfMake.createPdf(docDefinition).download(`Invoice_${data.details.invoiceNumber}.pdf`);
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (window.ErrorLogger) window.ErrorLogger.log({ type: 'PDF Generation Error', message: error.message, stack: error.stack });
        if (window.NotificationManager) window.NotificationManager.alert("Failed to generate PDF. Please check error logs.", "Error", "error");
    }
}
