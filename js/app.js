document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        items: [],
        taxType: 'Same State', // 'Same State' or 'Inter State'
        logoImage: null,
        signatureImage: null
    };

    const SUPABASE_URL = 'https://ftljcewqbknmtqamhdta.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0bGpjZXdxYmtubXRxYW1oZHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjgzODgsImV4cCI6MjA5NzkwNDM4OH0.sYya3IEZQMzVEmj8ihldvUlwKbH3ne5dzSDfJH3gJGo';
    let supabaseClient = null;

    const SupabaseManager = {
        isSyncing: false,
        syncKeys: [
            'invoice_history',
            'invoice_profiles_company',
            'invoice_profiles_client',
            'invoice_profiles_payment',
            'invoice_items_catalogue',
            'invoiceGeneratorDarkMode'
        ],
        
        init() {
            if (typeof supabase !== 'undefined') {
                supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                this.updateIndicator('Synced', 'text-success', 'fa-cloud-check');
                
                // Initial sync
                this.sync();
                
                // Sync every 15 seconds
                setInterval(() => this.sync(), 15000);
                
                // Setup Modal Listener for the indicator
                document.getElementById('syncIndicator').addEventListener('click', () => {
                    if (document.getElementById('syncText').innerText === 'Error') {
                        new bootstrap.Modal(document.getElementById('setupDatabaseModal')).show();
                    }
                });
            } else {
                this.updateIndicator('Offline', 'text-secondary', 'fa-cloud');
            }
        },

        updateIndicator(text, colorClass, iconClass) {
            const syncText = document.getElementById('syncText');
            const syncIcon = document.getElementById('syncIcon');
            if (syncText && syncIcon) {
                syncText.innerText = text;
                syncText.className = `small fw-bold ${colorClass}`;
                syncIcon.className = `fas ${iconClass} ${colorClass}`;
            }
        },

        async sync() {
            if (!supabaseClient || this.isSyncing) return;
            this.isSyncing = true;
            this.updateIndicator('Syncing...', 'text-warning', 'fa-sync fa-spin');

            try {
                let anyUpdates = false;

                for (const key of this.syncKeys) {
                    // Fetch local data
                    const localData = await StorageManager.getItem(key);
                    const localMeta = await StorageManager.getMetadata(key);
                    const localTime = new Date(localMeta.updated_at).getTime();

                    // Fetch remote data
                    const { data: remoteRows, error } = await supabaseClient
                        .from('sync_data')
                        .select('*')
                        .eq('key', key)
                        .limit(1);

                    if (error) {
                        throw error;
                    }

                    const remoteRow = remoteRows && remoteRows.length > 0 ? remoteRows[0] : null;

                    if (!remoteRow) {
                        // Remote is empty, push local if exists
                        if (localData) {
                            const { error: insertError } = await supabaseClient
                                .from('sync_data')
                                .insert({ key: key, value: localData, updated_at: localMeta.updated_at });
                            if (insertError) throw insertError;
                        }
                    } else {
                        const remoteTime = new Date(remoteRow.updated_at).getTime();
                        
                        // Compare timestamps
                        if (localTime > remoteTime && localData !== null) {
                            // Push local
                            const { error: updateError } = await supabaseClient
                                .from('sync_data')
                                .update({ value: localData, updated_at: localMeta.updated_at })
                                .eq('key', key);
                            if (updateError) throw updateError;
                        } else if (remoteTime > localTime) {
                            // Pull remote
                            await StorageManager.setRaw(key, remoteRow.value, remoteRow.updated_at);
                            anyUpdates = true;
                        }
                    }
                }

                if (anyUpdates) {
                    // Refresh UI if necessary
                    if (typeof InvoiceManager !== 'undefined') InvoiceManager.loadHistory();
                    if (typeof ProfileManager !== 'undefined') ProfileManager.loadProfiles();
                    if (typeof ItemManager !== 'undefined') ItemManager.loadItems();
                    if (typeof DarkModeManager !== 'undefined') DarkModeManager.load();
                }

                this.updateIndicator('Synced', 'text-success', 'fa-cloud');
            } catch (error) {
                console.error('Supabase Sync Error:', error);
                this.updateIndicator('Error', 'text-danger', 'fa-exclamation-triangle');
            } finally {
                this.isSyncing = false;
            }
        }
    };

    /**
     * StorageManager handles timestamped data persistence to support 
     * multi-device "Last-Write-Wins" synchronization.
     */
    const StorageManager = {
        async setItem(key, value) {
            const timestamp = new Date().toISOString();
            await localforage.setItem(key, value);
            await localforage.setItem(`${key}_meta`, { updated_at: timestamp });
            
            // Trigger sync immediately upon saving
            if (SupabaseManager.syncKeys.includes(key)) {
                SupabaseManager.sync();
            }
            
            return timestamp;
        },

        async getItem(key, defaultValue = null) {
            try {
                const data = await localforage.getItem(key);
                return data !== null ? data : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },

        async getMetadata(key) {
            const meta = await this.getItem(`${key}_meta`);
            return meta || { updated_at: '1970-01-01T00:00:00.000Z' };
        },

        async setRaw(key, value, timestamp) {
            await localforage.setItem(key, value);
            await localforage.setItem(`${key}_meta`, { updated_at: timestamp });
        }
    };

    // DOM Elements - Main
    const itemsBody = document.getElementById('itemsBody');
    const emptyState = document.getElementById('emptyState');
    const addItemBtn = document.getElementById('addItemBtn');
    const clientStateSelect = document.getElementById('clientState');
    const invoiceDate = document.getElementById('invoiceDate');

    // DOM Elements - Branding
    const logoUrl = document.getElementById('logoUrl');
    const previewLogoUrlBtn = document.getElementById('previewLogoUrlBtn');
    const logoPreview = document.getElementById('logoPreview');
    const logoPlaceholder = document.getElementById('logoPlaceholder');
    const signatureCanvas = document.getElementById('signatureCanvas');
    const clearSignatureBtn = document.getElementById('clearSignatureBtn');
    const signaturePreview = document.getElementById('sigCreatedPreview');
    const signaturePlaceholder = document.getElementById('sigCreatedPlaceholder');

    // Logo Option Toggle
    document.querySelectorAll('input[name="logoOption"]').forEach(el => {
        el.addEventListener('change', (e) => {
            const val = e.target.value;
            document.getElementById('logoUrlInput').classList.toggle('d-none', val !== 'url');
            document.getElementById('logoCreateInput').classList.toggle('d-none', val !== 'create');

            if (val === 'none') {
                state.logoImage = null;
                logoPreview.style.display = 'none';
                logoPlaceholder.style.display = 'block';
                logoUrl.value = '';
            } else if (val === 'url' && logoUrl.value) {
                // Restore URL preview if available
                previewLogoUrlBtn.click();
            }
        });
    });


    // Generate Logo from Name
    document.getElementById('generateLogoBtn').addEventListener('click', () => {
        const companyName = document.getElementById('companyName').value || 'Company';
        const customInitials = document.getElementById('logoInitials').value;
        const bgColor = document.getElementById('logoBgColor').value;
        const textColor = document.getElementById('logoTextColor').value;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');

        // Draw Background (Rounded Rect not easy in raw canvas without path, let's do Circle or Rect)
        // Let's do a filled square with rounded corners style or just a circle
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 500, 500);

        // Draw Text
        ctx.fillStyle = textColor;
        ctx.font = 'bold 80px sans-serif'; // Default size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let textToDraw = "";

        if (customInitials && customInitials.trim() !== "") {
            textToDraw = customInitials.trim().toUpperCase().substring(0, 3);
        } else {
            // Auto-scale text
            const words = companyName.split(' ');

            // Strategy: If name is long, take initials. If short (<= 2 words or < 15 chars), try to show full.
            // Actually, for a simple logo, Initials are often best.
            // Let's try to get up to 2 initials.
            if (words.length > 0) {
                textToDraw += words[0].charAt(0).toUpperCase();
                if (words.length > 1) {
                    textToDraw += words[1].charAt(0).toUpperCase();
                } else if (companyName.length > 1) {
                    textToDraw += companyName.charAt(1).toUpperCase();
                }
            }
        }

        // Override: if user wants full name, they might type it. 
        // But let's stick to initials for a "Logo" look. 
        // Or lets draw the Name if it fits? 
        // Let's do Initials - it's safer for a logo box.
        ctx.font = 'bold 250px Outfit, sans-serif';
        ctx.fillText(textToDraw, 250, 250);

        const dataUrl = canvas.toDataURL('image/png');
        state.logoImage = dataUrl;
        logoPreview.src = dataUrl;
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
    });

    document.querySelectorAll('input[name="signatureOption"]').forEach(el => {
        el.addEventListener('change', (e) => {
            const val = e.target.value;
            document.getElementById('sigDrawInput').classList.toggle('d-none', val !== 'draw');
            document.getElementById('sigUrlInput').classList.toggle('d-none', val !== 'url');
            document.getElementById('sigCreateInput').classList.toggle('d-none', val !== 'create');

            if (val === 'draw') {
                setTimeout(resizeCanvas, 0); // Trigger resize once visible
            } else if (val === 'url' && signatureUrl.value) {
                // Restore URL preview if available
                signatureUrl.dispatchEvent(new Event('input'));
            } else if (val === 'create') {
                // Maybe auto-generate if name is already filled? 
                // For now, let user click generate.
            }
        });
    });

    // Generate Signature from Name
    document.getElementById('generateSigBtn').addEventListener('click', () => {
        const name = document.getElementById('sigNameInput').value;
        const color = document.getElementById('sigColorInput').value;
        const font = document.getElementById('sigFontInput').value;

        if (!name) {
            NotificationManager.alert("Please enter a name for the signature.");
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 600; // Wider for signature
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Transparent Background
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Text
        ctx.fillStyle = color;
        // Use the custom font
        ctx.font = `100px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Wait for font to load? It's likely loaded by CSS, but valid check:
        document.fonts.load(`100px ${font}`).then(function () {
            ctx.fillText(name, canvas.width / 2, canvas.height / 2);

            const dataUrl = canvas.toDataURL('image/png');
            state.signatureImage = dataUrl;

            const preview = document.getElementById('sigCreatedPreview');
            preview.src = dataUrl;
            preview.style.display = 'block';
            document.getElementById('sigCreatedPlaceholder').style.display = 'none';
        }).catch(function(err) {
            console.error('Font failed to load, drawing with fallback font', err);
            ctx.fillText(name, canvas.width / 2, canvas.height / 2);
            
            const dataUrl = canvas.toDataURL('image/png');
            state.signatureImage = dataUrl;

            const preview = document.getElementById('sigCreatedPreview');
            preview.src = dataUrl;
            preview.style.display = 'block';
            document.getElementById('sigCreatedPlaceholder').style.display = 'none';
        });
    });

    // Signature URL
    const signatureUrl = document.getElementById('signatureUrl');
    signatureUrl.addEventListener('input', (e) => {
        const url = e.target.value;
        if (url) {
            convertImgToBase64(url, (base64) => {
                state.signatureImage = base64;
                document.getElementById('signatureUrlPreview').src = base64;
                document.getElementById('signatureUrlPreview').style.display = 'block';
                document.getElementById('signatureUrlPlaceholder').style.display = 'none';
            });
        } else {
            state.signatureImage = null;
            document.getElementById('signatureUrlPreview').style.display = 'none';
            document.getElementById('signatureUrlPlaceholder').style.display = 'block';
        }
    });

    // Clear Signature URL
    document.getElementById('clearSigUrlBtn').addEventListener('click', () => {
        signatureUrl.value = '';
        state.signatureImage = null;
        document.getElementById('signatureUrlPreview').style.display = 'none';
        document.getElementById('signatureUrlPreview').src = '';
        document.getElementById('signatureUrlPlaceholder').style.display = 'block';
    });

    // Logo URL Input - Auto Load
    logoUrl.addEventListener('input', (e) => {
        const url = e.target.value;
        if (url) {
            convertImgToBase64(url, (base64) => {
                state.logoImage = base64;
                logoPreview.src = base64;
                logoPreview.style.display = 'block';
                logoPlaceholder.style.display = 'none';
            });
        }
    });

    // Check if previewLogoUrlBtn exists before adding listener if needed, 
    // but assuming it does based on previous logic.
    previewLogoUrlBtn.addEventListener('click', () => {
        const url = logoUrl.value;
        if (url) {
            // Need to convert URL to Base64 for pdfMake
            convertImgToBase64(url, (base64) => {
                state.logoImage = base64;
                logoPreview.src = base64;
                logoPreview.style.display = 'block';
                logoPlaceholder.style.display = 'none';
            });
        }
    });

    // Clear Logo URL
    document.getElementById('clearLogoUrlBtn').addEventListener('click', () => {
        logoUrl.value = '';
        state.logoImage = null;
        logoPreview.style.display = 'none';
        logoPreview.src = '';
        logoPlaceholder.style.display = 'block';
    });



    // Signature Canvas
    const ctx = signatureCanvas.getContext('2d');
    let isDrawing = false;

    // Handle resizing
    function resizeCanvas() {
        const rect = signatureCanvas.parentElement.getBoundingClientRect();
        // Saving drawing content before resize? Ideally yes, but let's just clear for simple implementation or keep fixed width
        // Better to set fixed internal resolution
        signatureCanvas.width = rect.width;
        signatureCanvas.height = 150;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#000";
    }
    // Call once
    setTimeout(resizeCanvas, 100); // Small delay to let layout settle

    // Handle window resize
    window.addEventListener('resize', () => {
        // Save current signature if any
        const temp = state.signatureImage;
        resizeCanvas();
        // Restore if it was from URL or just let it clear (resizing wipes canvas)
        if (temp && temp.startsWith('data:image')) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = temp;
        }
    });

    function getPos(e) {
        const rect = signatureCanvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function startDraw(e) {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        e.preventDefault();
    }

    function draw(e) {
        if (!isDrawing) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        e.preventDefault();
    }

    function endDraw() {
        if (!isDrawing) return;
        isDrawing = false;
        // Save to state
        state.signatureImage = signatureCanvas.toDataURL();
    }

    signatureCanvas.addEventListener('mousedown', startDraw);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', endDraw);
    signatureCanvas.addEventListener('mouseout', endDraw);

    // Touch support
    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', draw, { passive: false });
    signatureCanvas.addEventListener('touchend', endDraw, { passive: false });

    clearSignatureBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        state.signatureImage = null;
        // If they switch modes, this state might conflict, but "Draw" mode prioritizes canvas
    });

    async function convertImgToBase64(url, callback) {
        if (!url.startsWith('http')) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                callback(canvas.toDataURL('image/png'));
            };
            img.onerror = function () {
                NotificationManager.alert('Could not load image. Try uploading the file instead.');
            };
            img.src = url;
            return;
        }

        const proxies = [
            '', // Direct
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url='
        ];

        for (const proxy of proxies) {
            try {
                let fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
                // For direct fetch, we might get CORS error which throws TypeError
                const response = await fetch(fetchUrl, {
                    // no-cors will return opaque response, we can't read it to base64, so we need cors
                    mode: 'cors'
                });
                if (!response.ok) throw new Error('Not ok');
                const blob = await response.blob();
                
                // If the blob is HTML instead of image, throw error
                if (blob.type.includes('text/html')) {
                    throw new Error('Received HTML instead of Image');
                }

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        callback(reader.result);
                        resolve();
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn('Failed to fetch image with proxy:', proxy, e);
                // continue to next proxy
            }
        }

        NotificationManager.alert('Could not load image. Likely CORS restriction. Try uploading the file instead.');
    }

    // Set default date
    invoiceDate.valueAsDate = new Date();

    // Event Listeners
    addItemBtn.addEventListener('click', addItem);
    clientStateSelect.addEventListener('change', (e) => {
        state.taxType = e.target.value;
        toggleTaxDisplay();
        calculateTotals();
    });

    // Add initial item
    addItem();

    // Auto-load default images
    if (logoUrl.value && !document.getElementById('logoUrlInput').classList.contains('d-none')) {
        previewLogoUrlBtn.click();
    }
    if (signatureUrl.value && !document.getElementById('sigUrlInput').classList.contains('d-none')) {
        signatureUrl.dispatchEvent(new Event('input'));
    }

    function addItem() {
        const id = Date.now();
        state.items.push({
            id,
            name: '',
            hsn: '',
            qty: 1,
            rate: 0,
            gst: 18
        });
        renderItems();
        calculateTotals();
    }

    function removeItem(id) {
        state.items = state.items.filter(item => item.id !== id);
        renderItems();
        calculateTotals();
    }

    // New Window function for inline calls
    window.updateItemData = (id, field, value) => {
        const item = state.items.find(i => i.id === id);
        if (item) {
            item[field] = value;
            updateRowTotal(id); // Only update this row's total text to avoid full re-render
            calculateTotals();
        }
    };

    window.deleteItem = (id) => {
        removeItem(id);
    };

    function updateRowTotal(id) {
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        const taxable = (item.qty || 0) * (item.rate || 0);
        const taxAmt = taxable * ((item.gst || 0) / 100);
        const total = taxable + taxAmt;

        // Find the specific row element
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const amountCell = row.querySelector('.row-amount');
            if (amountCell) amountCell.textContent = total.toFixed(2);
        }
    }

    function renderItems() {
        itemsBody.innerHTML = '';

        if (state.items.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        } else {
            emptyState.classList.add('d-none');
        }

        state.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-id', item.id);

            const taxable = item.qty * item.rate;
            const taxAmt = taxable * (item.gst / 100);
            const total = taxable + taxAmt;

            tr.innerHTML = `
            <td data-label="Item Name">
                <div class="input-group input-group-sm">
                    <input type="text" class="form-control" placeholder="Item Name" value="${item.name}" 
                        list="itemList"
                        oninput="updateItemData(${item.id}, 'name', this.value)"
                        onchange="checkAndAutoFill(${item.id}, this)">
                    <button class="btn btn-sm btn-outline-secondary" type="button" onclick="openItemModalForSelection(${item.id})" title="Pick from List">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
            </td>
            <td data-label="HSN/SAC"><input type="text" class="form-control form-control-sm" placeholder="HSN" value="${item.hsn}" oninput="updateItemData(${item.id}, 'hsn', this.value)"></td>
            <td data-label="Qty"><input type="number" class="form-control form-control-sm" placeholder="Qty" value="${item.qty}" oninput="updateItemData(${item.id}, 'qty', parseFloat(this.value))"></td>
            <td data-label="Rate"><input type="number" class="form-control form-control-sm" placeholder="Rate" value="${item.rate}" oninput="updateItemData(${item.id}, 'rate', parseFloat(this.value))"></td>
            <td data-label="GST">
                <input type="number" class="form-control form-control-sm" placeholder="GST" value="${item.gst}" list="gstRates" oninput="updateItemData(${item.id}, 'gst', parseFloat(this.value))">
            </td>
            <td data-label="Amount" class="text-end pe-4 fw-medium row-amount">${total.toFixed(2)}</td>
            <td class="text-center">
                <button type="button" class="delete-row-btn" onclick="deleteItem(${item.id})" title="Remove Item">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
            itemsBody.appendChild(tr);
        });
    }

    function toggleTaxDisplay() {
        const cgstRow = document.getElementById('cgstRow');
        const sgstRow = document.getElementById('sgstRow');
        const igstRow = document.getElementById('igstRow');

        if (state.taxType === 'Same State') {
            cgstRow.classList.remove('d-none');
            sgstRow.classList.remove('d-none');
            igstRow.classList.add('d-none');
        } else {
            cgstRow.classList.add('d-none');
            sgstRow.classList.add('d-none');
            igstRow.classList.remove('d-none');
        }
    }

    function calculateTotals() {
        let subtotal = 0;
        let initialCGST = 0;
        let initialSGST = 0;
        let initialIGST = 0;

        state.items.forEach(item => {
            const qty = item.qty || 0;
            const rate = item.rate || 0;
            const taxable = qty * rate;
            const taxRate = item.gst || 0;
            const taxAmt = taxable * (taxRate / 100);

            subtotal += taxable;

            if (state.taxType === 'Same State') {
                initialCGST += taxAmt / 2;
                initialSGST += taxAmt / 2;
            } else {
                initialIGST += taxAmt;
            }
        });

        // Discount Calculation
        const discountType = document.querySelector('input[name="discountType"]:checked').value;
        const discountVal = parseFloat(document.getElementById('discountValue').value) || 0;
        let discountAmount = 0;

        if (discountType === 'fixed') {
            discountAmount = discountVal;
        } else {
            discountAmount = subtotal * (discountVal / 100);
        }

        if (discountAmount > subtotal) discountAmount = subtotal; // Cap discount at subtotal

        // New logic: GST is calculated on Taxable Value (Subtotal - Discount)
        const taxableValue = subtotal - discountAmount;

        // Scale GST proportionally based on the discount applied to the subtotal
        const gstFactor = subtotal > 0 ? (taxableValue / subtotal) : 0;

        const totalCGST = initialCGST * gstFactor;
        const totalSGST = initialSGST * gstFactor;
        const totalIGST = initialIGST * gstFactor;

        const grandTotal = taxableValue + totalCGST + totalSGST + totalIGST;

        document.getElementById('summarySubtotal').textContent = '₹' + subtotal.toFixed(2);
        document.getElementById('summaryDiscount').textContent = '- ₹' + discountAmount.toFixed(2);
        document.getElementById('summaryCGST').textContent = '₹' + totalCGST.toFixed(2);
        document.getElementById('summarySGST').textContent = '₹' + totalSGST.toFixed(2);
        document.getElementById('summaryIGST').textContent = '₹' + totalIGST.toFixed(2);
        document.getElementById('summaryTotal').textContent = '₹' + grandTotal.toFixed(2);
        document.getElementById('summaryAmountInWords').textContent = numberToWords(grandTotal);

        // Save to state
        state.totals = {
            subtotal: subtotal,
            discount: discountAmount,
            taxableValue: taxableValue,
            cgst: totalCGST,
            sgst: totalSGST,
            igst: totalIGST,
            total: grandTotal
        };
    }

    // Discount Event Listeners
    document.querySelectorAll('input[name="discountType"]').forEach(el => {
        el.addEventListener('change', calculateTotals);
    });
    document.getElementById('discountValue').addEventListener('input', calculateTotals);

    // Exports
    // Reset Button
    // Reset Button - Custom Modal Logic
    const resetModalEl = document.getElementById('resetConfirmationModal');
    let resetModal = null;
    if (resetModalEl) {
        resetModal = new bootstrap.Modal(resetModalEl);
    }

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (resetModal) {
            resetModal.show();
        } else if (confirm('Are you sure you want to reset all values to default?')) {
            // Fallback if modal fails
            executeReset();
        }
    });

    document.getElementById('confirmResetBtn').addEventListener('click', () => {
        executeReset();
        if (resetModal) resetModal.hide();
    });

    function executeReset() {
        // Reset Form
        document.getElementById('invoiceForm').reset();
        invoiceDate.valueAsDate = new Date(); // Reset date to today

        // Reset State
        state.items = [];
        state.taxType = 'Same State';
        state.logoImage = null;
        state.signatureImage = null;

        // Reset Visuals
        itemsBody.innerHTML = '';
        addItem(); // add initial item

        // Clear Images & Canvas
        logoPreview.style.display = 'none';
        logoPlaceholder.style.display = 'block';
        signaturePreview.style.display = 'none';
        signaturePlaceholder.style.display = 'block';
        document.getElementById('signatureUrlPreview').style.display = 'none';
        document.getElementById('signatureUrlPlaceholder').style.display = 'block';
        ctx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        document.getElementById('invoiceNote').value = '';

        // Generate Next Invoice Number
        if (window.InvoiceManager && window.InvoiceManager.setNextInvoiceNumber) {
            window.InvoiceManager.setNextInvoiceNumber();
        }

        // Retrigger Toggles checks
        const logoOpt = document.querySelector('input[name="logoOption"]:checked');
        if (logoOpt) logoOpt.dispatchEvent(new Event('change'));
        const sigOpt = document.querySelector('input[name="signatureOption"]:checked');
        if (sigOpt) sigOpt.dispatchEvent(new Event('change'));

        calculateTotals();
    }

    // Download Handler with Save Prompt
    let pendingDownloadAction = null;
    const downloadModal = new bootstrap.Modal(document.getElementById('downloadOptionsModal'));

    document.getElementById('downloadSaveBtn').addEventListener('click', () => {
        if (pendingDownloadAction) {
            InvoiceManager.saveCurrent(); // Save first
            pendingDownloadAction(); // Then download
            downloadModal.hide();
            pendingDownloadAction = null;
        }
    });

    document.getElementById('downloadOnlyBtn').addEventListener('click', () => {
        if (pendingDownloadAction) {
            pendingDownloadAction(); // Just download
            downloadModal.hide();
            pendingDownloadAction = null;
        }
    });

    function handleDownload(action) {
        // Check if current data is different from saved data? 
        // For simplicity, just check if we have any items or details.
        // Or check if exact JSON matches last history entry?
        // Let's implement a "Dirty" check by comparing current gatherData with top of history.

        const currentData = gatherData();
        // Remove volatile fields if any (dates might differ by seconds?)
        // Actually gatherData has date string from input, so it's stable.

        let isDifferent = true;
        if (InvoiceManager.history.length > 0) {
            const lastSaved = InvoiceManager.history[0];

            // We need to compare relevant fields.
            // Simplified comparison:
            const currentStr = JSON.stringify({ d: currentData.details, i: currentData.items });
            const savedStr = JSON.stringify({ d: lastSaved.details, i: lastSaved.items });

            if (currentStr === savedStr) isDifferent = false;
        }

        if (isDifferent) {
            pendingDownloadAction = action;
            downloadModal.show();
        } else {
            action();
        }
    }

    document.getElementById('btnTaxInvoice').addEventListener('click', () => {
        handleDownload(() => generateTaxInvoice(gatherData()));
    });

    document.getElementById('btnSimpleInvoice').addEventListener('click', () => {
        handleDownload(() => generateSimpleInvoice(gatherData()));
    });

    document.getElementById('btnCombinedInvoice').addEventListener('click', () => {
        handleDownload(() => generateCombinedInvoice(gatherData()));
    });

    document.getElementById('btnChallan').addEventListener('click', () => {
        handleDownload(() => generateDeliveryChallan(gatherData()));
    });

    document.getElementById('btnQuote').addEventListener('click', () => {
        handleDownload(() => generateQuote(gatherData()));
    });

    function gatherData() {
        const totals = state.totals || { subtotal: 0, discount: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        const getVal = (id) => document.getElementById(id)?.value || '';

        return {
            details: {
                invoiceNumber: getVal('invoiceNumber'),
                date: getVal('invoiceDate'),
                companyName: getVal('companyName'),
                companyGst: getVal('companyGst'),
                companyPhone: getVal('companyPhone'),
                companyAddress: getVal('companyAddress'),
                clientName: getVal('clientName'),
                clientGst: getVal('clientGst'),
                clientPhone: getVal('clientPhone'),
                clientAddress: getVal('clientAddress'),
                taxType: state.taxType,
                logo: state.logoImage,
                signature: state.signatureImage,
                transportMode: getVal('transportMode'),
                vehicleNumber: getVal('vehicleNumber'),
                accountName: getVal('accountName'),
                bankName: getVal('bankName'),
                accountNumber: getVal('accountNumber'),
                ifscCode: getVal('ifscCode'),
                upiId: getVal('upiId'),
                note: getVal('invoiceNote')
            },
            items: state.items,
            totals: totals,
            numberInWords: numberToWords(totals.total),
            numberInWordsSimple: numberToWords(totals.taxableValue)
        };
    }

    function numberToWords(amount) {
        if (!amount || amount === 0) return 'Zero Rupees Only';

        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

        function convert(n) {
            if (n < 10) return ones[n];
            if (n < 20) return teens[n - 10];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
            if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
            if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
            return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
        }

        const integerPart = Math.floor(amount);
        const decimalPart = Math.round((amount - integerPart) * 100);

        let str = convert(integerPart) + ' Rupees';
        if (decimalPart > 0) {
            str += ' and ' + convert(decimalPart) + ' Paise';
        }

        return str + ' Only';
    }
    // Profile Manager Implementation
    const ProfileManager = {
        currentType: 'company',
        profiles: [],
        drawCanvas: null,
        drawCtx: null,
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        targetProfileIndex: -1,
        modal: null,
        drawModal: null,

        init() {
            // Main Profile Modal
            const elProfileModal = document.getElementById('profileModal');
            if (elProfileModal) {
                this.modal = new bootstrap.Modal(elProfileModal);
            }

            const btnAddRow = document.getElementById('addProfileRowBtn');
            if (btnAddRow) {
                btnAddRow.addEventListener('click', () => this.addRow());
            }

            // Draw Signature Modal - Init Once
            const elDrawModal = document.getElementById('drawModal');
            if (elDrawModal) {
                this.drawModal = new bootstrap.Modal(elDrawModal);
            }

            // Draw Canvas Init
            const canvas = document.getElementById('profileSigCanvas');
            if (canvas) {
                this.drawCanvas = canvas;
                this.drawCtx = canvas.getContext('2d');

                // Mouse Events
                canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
                canvas.addEventListener('mousemove', (e) => this.draw(e));
                canvas.addEventListener('mouseup', () => this.stopDrawing());
                canvas.addEventListener('mouseout', () => this.stopDrawing());

                // Touch Events
                canvas.addEventListener('touchstart', (e) => {
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousedown', {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    canvas.dispatchEvent(mouseEvent);
                    e.preventDefault();
                }, { passive: false }); // passive: false to allow preventDefault

                canvas.addEventListener('touchmove', (e) => {
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    canvas.dispatchEvent(mouseEvent);
                    e.preventDefault();
                }, { passive: false });

                canvas.addEventListener('touchend', () => {
                    const mouseEvent = new MouseEvent('mouseup', {});
                    canvas.dispatchEvent(mouseEvent);
                });
            }
        },

        startDrawing(e) {
            this.isDrawing = true;
            [this.lastX, this.lastY] = [e.offsetX, e.offsetY];
        },
        draw(e) {
            if (!this.isDrawing) return;
            this.drawCtx.beginPath();
            this.drawCtx.moveTo(this.lastX, this.lastY);
            this.drawCtx.lineTo(e.offsetX, e.offsetY);
            this.drawCtx.stroke();
            [this.lastX, this.lastY] = [e.offsetX, e.offsetY];
        },
        stopDrawing() {
            this.isDrawing = false;
        },
        clearDrawCanvas() {
            if (this.drawCtx && this.drawCanvas) {
                this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
            }
        },
        openDrawModal(index) {
            this.targetProfileIndex = index;
            this.clearDrawCanvas();
            // Use stored instance
            if (this.drawModal) {
                this.drawModal.show();
            } else {
                console.error("Draw Modal not initialized");
            }
        },
        saveDrawing() {
            if (this.targetProfileIndex > -1 && this.drawCanvas) {
                const dataUrl = this.drawCanvas.toDataURL();
                this.updateField(this.targetProfileIndex, 'signatureUrl', dataUrl);
                this.renderTable();

                if (this.drawModal) {
                    this.drawModal.hide();
                }
            }
        },

        async open(type) {
            this.currentType = type;
            let title = 'Manage Profiles';
            if (type === 'company') title = 'Manage Company Profiles';
            else if (type === 'client') title = 'Manage Client Profiles';
            else if (type === 'payment') title = 'Manage Payment Details';

            const titleEl = document.getElementById('profileModalTitle');
            if (titleEl) titleEl.textContent = title;

            await this.loadProfiles();
            this.renderTable();
            if (this.modal) this.modal.show();
        },

        async loadProfiles() {
            let key = 'invoice_profiles_company';
            if (this.currentType === 'client') key = 'invoice_profiles_client';
            if (this.currentType === 'payment') key = 'invoice_profiles_payment';

            const parsed = await StorageManager.getItem(key, []);
            this.profiles = Array.isArray(parsed) ? parsed : [];

            if (this.currentType === 'company') {
                for (let p of this.profiles) {
                    if (p.logoUrl && p.logoUrl.startsWith('img_ref::')) {
                        p.logoUrl = await ImageManager.get(p.logoUrl);
                    }
                    if (p.signatureUrl && p.signatureUrl.startsWith('img_ref::')) {
                        p.signatureUrl = await ImageManager.get(p.signatureUrl);
                    }
                }
            }
        },

        async loadDefaults() {
            const types = ['company', 'client', 'payment'];
            for (const type of types) {
                const key = `invoice_profiles_${type}`;
                const rawData = await StorageManager.getItem(key, []);
                if (Array.isArray(rawData) && rawData.length > 0) {
                    let profiles = rawData;

                    if (type === 'company') {
                        for (let p of profiles) {
                            if (p.logoUrl && p.logoUrl.startsWith('img_ref::')) {
                                p.logoUrl = await ImageManager.get(p.logoUrl);
                            }
                            if (p.signatureUrl && p.signatureUrl.startsWith('img_ref::')) {
                                p.signatureUrl = await ImageManager.get(p.signatureUrl);
                            }
                        }
                    }

                    if (profiles.length > 0) {
                        // Temporarily switch type to load
                        const prevType = this.currentType;
                        this.currentType = type;
                        this.profiles = profiles;
                        this.useProfile(0);
                        this.currentType = prevType;
                        this.profiles = [];
                    }
                }
            }
        },

        async saveProfiles() {
            try {
                let key = 'invoice_profiles_company';
                if (this.currentType === 'client') key = 'invoice_profiles_client';
                if (this.currentType === 'payment') key = 'invoice_profiles_payment';

                if (this.currentType === 'company') {
                    // Process images in a copy
                    const profilesToSave = JSON.parse(JSON.stringify(this.profiles));
                    for (let p of profilesToSave) {
                        if (p.logoUrl && p.logoUrl.startsWith('data:image')) {
                            p.logoUrl = await ImageManager.store(p.logoUrl);
                        }
                        if (p.signatureUrl && p.signatureUrl.startsWith('data:image')) {
                            p.signatureUrl = await ImageManager.store(p.signatureUrl);
                        }
                    }
                    await StorageManager.setItem(key, profilesToSave);
                } else {
                    await StorageManager.setItem(key, this.profiles);
                }
            } catch (error) {
                console.error('Save Profiles Failed:', error);
                if (error.message && error.message.includes('Table not found')) {
                    // Handled by ImageManager alert
                } else {
                    NotificationManager.alert('Failed to save profiles. ' + error.message, 'Save Error', 'error');
                }
            }
        },

        fields() {
            switch (this.currentType) {
                case 'company':
                    return [
                        { key: 'companyName', label: 'Company Name', id: 'companyName' },
                        { key: 'companyAddress', label: 'Address', id: 'companyAddress' },
                        { key: 'companyGstin', label: 'GSTIN', id: 'companyGst' },
                        { key: 'companyPhone', label: 'Phone', id: 'companyPhone' },
                        { key: 'companyEmail', label: 'Email', id: 'companyEmail' },

                        // Logo Fields
                        {
                            key: 'logoOption', label: 'Logo Type', id: 'logoOption', type: 'radio',
                            options: [{ v: 'url', l: 'URL' }, { v: 'create', l: 'Create' }, { v: 'none', l: 'None' }]
                        },
                        { key: 'logoUrl', label: 'Logo URL', id: 'logoUrl' },
                        { key: 'logoInitials', label: 'Logo Initials', id: 'logoInitials' },
                        { key: 'logoBgColor', label: 'Logo Bg', id: 'logoBgColor', type: 'color' },
                        { key: 'logoTextColor', label: 'Logo Text', id: 'logoTextColor', type: 'color' },

                        // Signature Fields
                        {
                            key: 'signatureOption', label: 'Sig Type', id: 'signatureOption', type: 'radio',
                            options: [{ v: 'url', l: 'URL' }, { v: 'draw', l: 'Draw' }, { v: 'create', l: 'Create' }]
                        },
                        { key: 'signatureDraw', label: 'Draw Sig', id: 'sigDrawAction', type: 'draw_action' },
                        { key: 'signatureUrl', label: 'Sig URL', id: 'signatureUrl' },
                        { key: 'sigName', label: 'Sig Name', id: 'sigNameInput' },
                        {
                            key: 'sigFont', label: 'Sig Font', id: 'sigFontInput', type: 'select',
                            options: ['WhisperingSignature', 'BastligaOne', 'AmsterdamHandwriting', 'Palisade', 'Priestacy', 'Signatie', 'Modernline']
                        },
                        { key: 'sigColor', label: 'Sig Color', id: 'sigColorInput', type: 'color' }
                    ];
                case 'client':
                    return [
                        { key: 'clientName', label: 'Client Name', id: 'clientName' },
                        { key: 'clientAddress', label: 'Address', id: 'clientAddress' },
                        { key: 'clientGstin', label: 'GSTIN', id: 'clientGst' },
                        { key: 'clientPhone', label: 'Phone', id: 'clientPhone' },
                        { key: 'clientEmail', label: 'Email', id: 'clientEmail' },
                        { key: 'clientNotes', label: 'Notes', id: 'clientNotes' },
                        { key: 'state', label: 'State', id: 'clientState', type: 'select', options: ['Same State', 'Inter State'] }
                    ];
                case 'payment':
                    return [
                        { key: 'accountName', label: 'Account Name', id: 'accountName' },
                        { key: 'bankName', label: 'Bank Name - Branch', id: 'bankName' },
                        { key: 'accountNumber', label: 'Account No', id: 'accountNumber' },
                        { key: 'ifscCode', label: 'IFSC', id: 'ifscCode' },
                        { key: 'upiId', label: 'UPI ID', id: 'upiId' }
                    ];
                default: return [];
            }
        },

        async autoSaveClient() {
            // Logic handled by main app save flow usually, but we keep this for specific field blurs
            const clientName = document.getElementById('clientName').value;
            if (!clientName) return;

            const key = 'invoice_profiles_client';
            const parsed = await StorageManager.getItem(key, []);
            let profiles = Array.isArray(parsed) ? parsed : [];

            // Check if exists
            const existingIndex = profiles.findIndex(p => p.clientName === clientName);

            const currentProfile = {
                clientName: clientName,
                clientAddress: document.getElementById('clientAddress').value,
                clientGstin: document.getElementById('clientGst').value,
                clientPhone: document.getElementById('clientPhone').value,
                clientEmail: document.getElementById('clientEmail').value,
                clientNotes: document.getElementById('clientNotes').value,
                state: document.getElementById('clientState').value
            };

            if (existingIndex !== -1) {
                profiles[existingIndex] = currentProfile;
            } else {
                profiles.push(currentProfile);
            }
            await StorageManager.setItem(key, profiles);
        },

        renderTable() {
            const fields = this.fields();
            const thead = document.getElementById('profileTableHeader');
            const tbody = document.getElementById('profileTableBody');
            const emptyState = document.getElementById('profileEmptyState');

            // Header
            thead.innerHTML = '';
            fields.forEach(f => {
                const th = document.createElement('th');
                th.textContent = f.label;
                th.style.whiteSpace = 'nowrap';
                thead.appendChild(th);
            });
            thead.innerHTML += '<th style="width: 150px;">Actions</th>';

            // Body
            tbody.innerHTML = '';
            if (this.profiles.length === 0) {
                emptyState.classList.remove('d-none');
            } else {
                emptyState.classList.add('d-none');
                this.profiles.forEach((profile, index) => {
                    const tr = document.createElement('tr');
                    fields.forEach(f => {
                        const td = document.createElement('td');
                        td.setAttribute('data-label', f.label);

                        const fieldId = `pfield-${index}-${f.key}`;

                        if (f.options) {
                            // Select (works for both 'select' and 'radio' type storage in table as dropdown)
                            const select = document.createElement('select');
                            select.id = fieldId;
                            select.className = 'form-select form-select-sm border-0 bg-transparent';
                            select.style.minWidth = '100px';

                            f.options.forEach(opt => {
                                const option = document.createElement('option');
                                const val = typeof opt === 'object' ? opt.v : opt;
                                const lbl = typeof opt === 'object' ? opt.l : (opt === 'Same State' ? 'Intra-State' : (opt === 'Inter State' ? 'Inter-State' : opt));

                                option.value = val;
                                option.textContent = lbl;
                                if (val === profile[f.key]) option.selected = true;
                                select.appendChild(option);
                            });
                            select.addEventListener('change', (e) => {
                                this.updateField(index, f.key, e.target.value);
                                this.updateUIState(index);
                                // Force re-render to toggle buttons if needed
                                this.renderTable();
                            });
                            td.appendChild(select);
                        } else if (f.type === 'color') {
                            const input = document.createElement('input');
                            input.id = fieldId;
                            input.type = 'color';
                            input.className = 'form-control form-control-color border-0 bg-transparent';
                            input.value = profile[f.key] || '#000000';
                            input.title = profile[f.key];
                            input.addEventListener('input', (e) => this.updateField(index, f.key, e.target.value));
                            td.appendChild(input);
                        } else if (f.type === 'draw_action') {
                            // Custom Drawing Column
                            if (profile.signatureOption === 'draw') {
                                const container = document.createElement('div');
                                container.className = 'd-flex align-items-center';

                                const btn = document.createElement('button');
                                btn.className = 'btn btn-sm btn-outline-primary me-2';
                                btn.innerHTML = '<i class="fas fa-pen"></i>';
                                btn.title = "Open Draw Canvas";
                                btn.onclick = () => this.openDrawModal(index);
                                container.appendChild(btn);

                                if (profile.signatureUrl && profile.signatureUrl.startsWith('data:image')) {
                                    const img = document.createElement('img');
                                    img.src = profile.signatureUrl;
                                    img.style.height = '30px';
                                    img.className = 'border rounded';
                                    container.appendChild(img);
                                }
                                td.appendChild(container);
                            } else {
                                td.textContent = '-';
                                td.className = 'text-muted text-center';
                            }
                        } else {
                            // Text Input
                            const input = document.createElement('input');
                            input.id = fieldId;
                            input.type = 'text';
                            input.className = 'form-control form-control-sm border-0 bg-transparent';
                            input.value = profile[f.key] || '';
                            input.placeholder = f.label;
                            input.style.minWidth = '120px';

                            // Special logic for Signature URL when option is DRAW
                            if (f.key === 'signatureUrl' && profile.signatureOption === 'draw') {
                                input.readOnly = true;
                                input.placeholder = "(Drawing Data)";
                                input.className += ' text-muted fst-italic';
                                if (input.value.length > 20) input.value = 'Captured Data...'; // Don't show massive base64
                            }

                            input.addEventListener('input', (e) => this.updateField(index, f.key, e.target.value));
                            td.appendChild(input);
                        }
                        tr.appendChild(td);
                    });

                    // Reorder & Actions
                    const actionTd = document.createElement('td');
                    actionTd.setAttribute('data-label', 'Actions');
                    actionTd.style.whiteSpace = 'nowrap';
                    actionTd.innerHTML = `
                         <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveProfile(${index}, -1)" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveProfile(${index}, 1)" title="Move Down" ${index === this.profiles.length - 1 ? 'disabled' : ''}>
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button class="btn btn-sm btn-success me-1" onclick="useProfile(${index})" title="Use">
                            <i class="fas fa-check"></i> 
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProfile(${index})" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    tr.appendChild(actionTd);
                    tbody.appendChild(tr);

                    // Initialize UI State
                    this.updateUIState(index);
                });
            }
        },

        updateUIState(index) {
            const profile = this.profiles[index];
            const getEl = (key) => document.getElementById(`pfield-${index}-${key}`);

            // 1. Logo Logic
            if (profile.logoOption) {
                const isUrl = profile.logoOption === 'url';
                const isCreate = profile.logoOption === 'create';

                const urlEl = getEl('logoUrl');
                if (urlEl) {
                    urlEl.disabled = !isUrl;
                    urlEl.style.opacity = isUrl ? '1' : '0.5';
                }

                ['logoInitials', 'logoBgColor', 'logoTextColor'].forEach(k => {
                    const el = getEl(k);
                    if (el) {
                        el.disabled = !isCreate;
                        el.style.opacity = isCreate ? '1' : '0.5';
                    }
                });
            }

            // 2. Signature Logic
            if (profile.signatureOption) {
                const isUrl = profile.signatureOption === 'url';
                const isCreate = profile.signatureOption === 'create';

                const urlEl = getEl('signatureUrl');
                if (urlEl) {
                    if (profile.signatureOption === 'draw') {
                        // handled by Button replacement in renderTable
                    } else {
                        urlEl.disabled = !isUrl;
                        urlEl.style.opacity = isUrl ? '1' : '0.5';
                    }
                }

                ['sigName', 'sigFont', 'sigColor'].forEach(k => {
                    const el = getEl(k);
                    if (el) {
                        el.disabled = !isCreate;
                        el.style.opacity = isCreate ? '1' : '0.5';
                    }
                });
            }
        },

        addRow() {
            const newProfile = {};
            this.fields().forEach(f => {
                if (f.key === 'logoOption') newProfile[f.key] = 'url';
                else if (f.key === 'signatureOption') newProfile[f.key] = 'url';
                else if (f.key === 'state') newProfile[f.key] = 'Same State';
                else if (f.key === 'sigFont') newProfile[f.key] = 'WhisperingSignature';
                else if (f.type === 'color') newProfile[f.key] = '#000000';
                else newProfile[f.key] = '';
            });
            this.profiles.push(newProfile);
            this.saveProfiles();
            this.renderTable();
        },

        updateField(index, key, value) {
            this.profiles[index][key] = value;
            this.saveProfiles();
        },

        deleteProfile(index) {
            if (confirm('Delete this profile?')) {
                this.profiles.splice(index, 1);
                this.saveProfiles();
                this.renderTable();
            }
        },

        moveProfile(index, direction) {
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= this.profiles.length) return;

            // Swap
            [this.profiles[index], this.profiles[newIndex]] = [this.profiles[newIndex], this.profiles[index]];
            this.saveProfiles();
            this.renderTable();
        },

        useProfile(index) {
            const profile = this.profiles[index];
            const fields = this.fields();

            // First pass: Set values
            fields.forEach(f => {
                if (f.type === 'radio') {
                    // Check the specific radio button
                    const radio = document.querySelector(`input[name="${f.id}"][value="${profile[f.key]}"]`);
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change'));
                    }
                } else {
                    const el = document.getElementById(f.id);
                    if (el) {
                        el.value = profile[f.key];
                        // Trigger input event for colors and text to ensure UI updates
                        el.dispatchEvent(new Event('input'));
                        el.dispatchEvent(new Event('change'));
                    }
                }
            });

            // Second pass: Trigger Actions (Logo Gen, Sig Gen)
            setTimeout(() => {
                // If Logo Create
                if (profile.logoOption === 'create') {
                    const btn = document.getElementById('generateLogoBtn');
                    if (btn) btn.click();
                }

                // If Signature Draw - AND we have data
                if (profile.signatureOption === 'draw' && profile.signatureUrl) {
                    const sigCanvas = document.getElementById('signatureCanvas');
                    if (sigCanvas && sigCanvas.getContext) {
                        const ctx = sigCanvas.getContext('2d');
                        const img = new Image();
                        img.onload = () => {
                            ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
                            ctx.drawImage(img, 0, 0);

                            // Update state manually as we bypassed usual input method
                            state.signatureImage = profile.signatureUrl;


                        };
                        img.src = profile.signatureUrl;
                    }
                }

                // If Signature Create
                if (profile.signatureOption === 'create') {
                    const btn = document.getElementById('generateSigBtn');
                    if (btn) btn.click();
                }
            }, 100);

            if (this.modal) this.modal.hide();
        }
    };

    // Initialize Profile Logic
    ProfileManager.init();

    // Expose global functions for HTML onclick
    window.ProfileManager = ProfileManager;
    window.openProfileModal = (type) => ProfileManager.open(type);
    window.deleteProfile = (index) => ProfileManager.deleteProfile(index);
    window.useProfile = (index) => ProfileManager.useProfile(index);
    window.moveProfile = (index, dir) => ProfileManager.moveProfile(index, dir);



    // Auto-Save Listeners for Client Fields
    ['clientName', 'clientAddress', 'clientGst', 'clientPhone', 'clientEmail', 'clientNotes', 'clientState'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => ProfileManager.autoSaveClient());
        }
    });




    // Item Manager Implementation
    const ItemManager = {
        items: [],
        modal: null,
        targetRowId: null,

        async init() {
            this.modal = new bootstrap.Modal(document.getElementById('itemModal'));
            await this.loadItems();
            this.updateDatalist();
        },

        async loadItems() {
            const parsed = await StorageManager.getItem('invoice_items_catalogue', []);
            this.items = Array.isArray(parsed) ? parsed : [];
        },

        async saveItems() {
            await StorageManager.setItem('invoice_items_catalogue', this.items);
            this.updateDatalist();
        },

        updateDatalist() {
            const datalist = document.getElementById('itemList');
            if (datalist) {
                datalist.innerHTML = '';
                this.items.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.name;
                    datalist.appendChild(opt);
                });
            }
        },

        renderTable() {
            const tbody = document.getElementById('itemTableBody');
            const emptyState = document.getElementById('itemEmptyState');
            tbody.innerHTML = '';

            if (this.items.length === 0) {
                emptyState.classList.remove('d-none');
            } else {
                emptyState.classList.add('d-none');
                this.items.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td data-label="Item Name"><input type="text" class="form-control form-control-sm" value="${item.name}" onchange="ItemManager.updateField(${index}, 'name', this.value)"></td>
                        <td data-label="HSN/SAC"><input type="text" class="form-control form-control-sm" value="${item.hsn}" onchange="ItemManager.updateField(${index}, 'hsn', this.value)"></td>
                        <td data-label="Rate"><input type="number" class="form-control form-control-sm" value="${item.rate}" onchange="ItemManager.updateField(${index}, 'rate', parseFloat(this.value))"></td>
                        <td data-label="GST %"><input type="number" class="form-control form-control-sm" value="${item.gst}" onchange="ItemManager.updateField(${index}, 'gst', parseFloat(this.value))"></td>
                        <td data-label="Actions">
                            <button class="btn btn-sm btn-success me-1" onclick="ItemManager.useItem(${index})">
                                <i class="fas fa-check"></i> Use
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="ItemManager.deleteItem(${index})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        },

        updateField(index, key, value) {
            this.items[index][key] = value;
            this.saveItems();
        },

        deleteItem(index) {
            if (confirm('Delete this item?')) {
                this.items.splice(index, 1);
                this.saveItems();
                this.renderTable();
            }
        },

        addRow() {
            this.items.push({ name: '', hsn: '', rate: 0, gst: 18 });
            this.saveItems();
            this.renderTable();
        },

        open(targetId = null) {
            this.targetRowId = targetId;
            this.renderTable();
            this.modal.show();
        },

        useItem(index) {
            const item = this.items[index];
            if (this.targetRowId) {
                // Populate specific row
                const rowItem = state.items.find(i => i.id === this.targetRowId);
                if (rowItem) {
                    rowItem.name = item.name;
                    rowItem.hsn = item.hsn;
                    rowItem.rate = item.rate;
                    rowItem.gst = item.gst;
                    // Trigger refresh
                    renderItems();
                    calculateTotals();
                }
            } else {
                // Add as new row
                const id = Date.now();
                state.items.push({
                    id,
                    name: item.name,
                    hsn: item.hsn,
                    qty: 1,
                    rate: item.rate,
                    gst: item.gst
                });
                renderItems();
                calculateTotals();
            }
            this.modal.hide();
        },

        // Auto Save Logic
        checkAndSave(name, hsn, rate, gst) {
            if (!name) return;
            // Only save if we have a rate (implies "fully entered" somewhat)
            if (!rate || rate <= 0) return;

            // Check if exists
            const exists = this.items.find(i => i.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
                this.items.push({ name, hsn: hsn || '', rate: rate, gst: gst || 18 });
                this.saveItems();
                // Auto-saved new item
                return;
            }
        }
    };

    // Initialize
    ItemManager.init();

    // Global Exposure
    window.ItemManager = ItemManager;
    window.openItemModal = () => ItemManager.open();
    window.openItemModalForSelection = (id) => ItemManager.open(id);

    // Auto-fill and Auto-save Handler
    window.checkAndAutoFill = (id, input) => {
        const val = input.value;
        const item = ItemManager.items.find(i => i.name === val);
        if (item) {
            // Auto-fill
            window.updateItemData(id, 'hsn', item.hsn);
            window.updateItemData(id, 'rate', item.rate);
            window.updateItemData(id, 'gst', item.gst);
            // Re-render to show updated values
            renderItems();
            calculateTotals();
        } else {
            // It's a new item (or name changed)
            const row = state.items.find(i => i.id === id);
            if (row && row.name) {
                ItemManager.checkAndSave(row.name, row.hsn, row.rate, row.gst);
            }
        }
    };

    // Hook into updateItemData to trigger auto-save on other fields changing too
    const originalUpdate = window.updateItemData;
    window.updateItemData = (id, field, value) => {
        originalUpdate(id, field, value); // Call original
        // Try auto-save if we have enough info
        const row = state.items.find(i => i.id === id);
        if (row && row.name && field !== 'qty') { // Don't save on qty change
            ItemManager.checkAndSave(row.name, row.hsn, row.rate, row.gst);
        }
    };

    // Invoice History & Management
    const InvoiceManager = {
        history: [],
        modal: null,
        previewModal: null,
        currentPreviewIndex: null,
        sortField: 'savedAt',
        sortDirection: 'desc',
        searchQuery: '',

        async init() {
            this.modal = new bootstrap.Modal(document.getElementById('historyModal'));
            const pmEl = document.getElementById('previewModal');
            if (pmEl) this.previewModal = new bootstrap.Modal(pmEl);
            await this.loadHistory();
        },

        async loadHistory() {
            const parsed = await StorageManager.getItem('invoice_history', []);
            this.history = Array.isArray(parsed) ? parsed : [];
            // Initialize Invoice Number on Load
            this.setNextInvoiceNumber();
        },

        async saveHistory() {
            try {
                await StorageManager.setItem('invoice_history', this.history);
            } catch (e) {
                console.error('Storage failed:', e);
                alert('Storage full! Could not save history. Please delete old invoices or use smaller images.');
                // Remove the failed entry from memory so UI stays consistent
                this.history.shift();
            }
        },

        async saveCurrent() {
            try {
                const data = gatherData();
                let snapshot = {
                    id: Date.now(),
                    savedAt: new Date().toLocaleString(),
                    details: { ...data.details },
                    items: JSON.parse(JSON.stringify(state.items)),
                    totals: data.totals,
                    settings: JSON.parse(JSON.stringify(data.details))
                };
                snapshot.settings.discountType = document.querySelector('input[name="discountType"]:checked').value;
                snapshot.settings.discountValue = document.getElementById('discountValue').value;

                // Process Images
                snapshot = await ImageManager.processInvoiceForSave(snapshot);

                // Check for duplicate Invoice Number
                const existingIndex = this.history.findIndex(inv => inv.details.invoiceNumber === data.details.invoiceNumber);

                if (existingIndex !== -1) {
                    NotificationManager.confirm(
                        `Invoice number "${data.details.invoiceNumber}" already exists in history. Do you want to overwrite it?`,
                        async () => {
                            // Update existing
                            // Keep original savedAt? Or update it? Let's update it to now.
                            this.history[existingIndex] = { ...snapshot, savedAt: this.history[existingIndex].savedAt };
                            await this.saveHistory();

                            NotificationManager.alert('Invoice updated successfully!', 'Success', 'success');
                            this.renderTable(); // Re-render if open
                        },
                        'Overwrite Invoice',
                        'warning'
                    );
                } else {
                    // New Invoice
                    this.history.unshift(snapshot);
                    if (this.history.length > 50) this.history.pop();
                    await this.saveHistory();

                    NotificationManager.alert('Invoice saved successfully!', 'Success', 'success');
                    this.renderTable(); // Re-render
                }
            } catch (error) {
                console.error('Save Failed:', error);

                // If it was a specific known error (like missing table), it might have already alerted.
                // But just in case:
                if (error.message && error.message.includes('Table not found')) {
                    // Already handled in ImageManager probably, but good backup 
                } else {
                    NotificationManager.alert('Failed to save invoice. ' + error.message, 'Save Error', 'error');
                }
            }
        },

        generateNextInvoiceNumber() {
            const date = new Date();
            const yearStr = date.getFullYear().toString().slice(-2);
            const prefix = `INV-${yearStr}-`;

            let maxNum = 0;
            this.history.forEach(inv => {
                if (inv.details && inv.details.invoiceNumber && inv.details.invoiceNumber.startsWith(prefix)) {
                    const parts = inv.details.invoiceNumber.split('-');
                    if (parts.length === 3) {
                        const num = parseInt(parts[2], 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                }
            });

            const nextNum = maxNum + 1;
            return `${prefix}${nextNum.toString().padStart(3, '0')}`;
        },

        setNextInvoiceNumber() {
            const nextInv = this.generateNextInvoiceNumber();
            const el = document.getElementById('invoiceNumber');
            if (el) el.value = nextInv;
        },

        sortHistory(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc'; // Default to asc for new field? Or desc?
                // For date/amount usually desc is better initially, but standard is asc.
                // Let's stick to asc for new fields, except maybe Date which users often want latest first.
                if (field === 'savedAt' || field === 'totals.total') this.sortDirection = 'desc';
            }
            this.renderTable();
        },

        openHistory() {
            this.searchQuery = ''; // Reset search on open
            const searchInput = document.getElementById('invoiceSearchInput');
            if (searchInput) searchInput.value = '';
            
            this.renderTable();
            this.modal.show();
        },

        handleSearch(query) {
            this.searchQuery = query.toLowerCase().trim();
            this.renderTable();
        },

        renderTable() {
            const tbody = document.getElementById('historyTableBody');
            const emptyState = document.getElementById('historyEmptyState');
            tbody.innerHTML = '';

            // Update Header Icons
            const headers = {
                'savedAt': 0,
                'details.invoiceNumber': 1,
                'details.clientName': 2,
                'totals.total': 3
            };

            // Reset icons (if we had them in HTML, we would toggle classes. For now, assuming we might adding them dynamically or just logic)
            // Ideally we should update the TH classes. 
            // Since we haven't modified HTML yet, let's just do the sorting logic first.

            // Filter based on search query
            let filteredHistory = this.history;
            if (this.searchQuery) {
                filteredHistory = this.history.filter(inv => {
                    const invNumber = (inv.details.invoiceNumber || '').toLowerCase();
                    const client = (inv.details.clientName || '').toLowerCase();
                    const amount = (inv.totals?.total || 0).toString();
                    return invNumber.includes(this.searchQuery) || client.includes(this.searchQuery) || amount.includes(this.searchQuery);
                });
            }

            let sortedHistory = [...filteredHistory];
            sortedHistory.sort((a, b) => {
                let valA, valB;

                if (this.sortField === 'savedAt') {
                    // savedAt is localized string "M/D/YYYY, H:MM:SS AM/PM", parsing might be tricky.
                    // But we have 'id' which is timestamp.
                    valA = a.id;
                    valB = b.id;
                } else if (this.sortField.includes('.')) {
                    const parts = this.sortField.split('.');
                    valA = a[parts[0]][parts[1]];
                    valB = b[parts[0]][parts[1]];
                } else {
                    valA = a[this.sortField];
                    valB = b[this.sortField];
                }

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });

            if (sortedHistory.length === 0) {
                emptyState.classList.remove('d-none');
            } else {
                emptyState.classList.add('d-none');
                sortedHistory.forEach((record, index) => {
                    // map index back to original history index for actions? 
                    // Or just pass the record itself to load?
                    // The existing load() uses index. 
                    // So we need to find the index in the original array.
                    const originalIndex = this.history.indexOf(record);

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td data-label="Date Saved">${record.savedAt}</td>
                        <td data-label="Invoice #" class="fw-bold">${record.details.invoiceNumber}</td>
                        <td data-label="Client">${record.details.clientName || '-'}</td>
                        <td data-label="Amount">₹${record.totals.total.toFixed(2)}</td>
                        <td data-label="Actions">
                            <div class="d-flex align-items-center gap-1">
                                <button class="btn btn-sm btn-info text-white" onclick="InvoiceManager.preview(${originalIndex})" title="Preview Invoice">
                                    <i class="fas fa-eye"></i> Preview
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="InvoiceManager.load(${originalIndex})" title="Load Invoice">
                                    <i class="fas fa-box-open"></i> Load
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="InvoiceManager.duplicate(${originalIndex})" title="Duplicate Invoice">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <div class="dropdown d-inline-block">
                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" data-bs-boundary="viewport" aria-expanded="false" title="Download Options">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-end shadow border-0" style="z-index: 1060;">
                                        <li><a class="dropdown-item py-2 d-flex align-items-center" href="#" onclick="InvoiceManager.downloadFromHistory(${originalIndex}, 'simple'); return false;"><i class="fas fa-file-invoice text-success me-2 fs-6"></i> Simple Invoice</a></li>
                                        <li><a class="dropdown-item py-2 d-flex align-items-center" href="#" onclick="InvoiceManager.downloadFromHistory(${originalIndex}, 'combined'); return false;"><i class="fas fa-file-invoice text-success me-2 fs-6"></i> Combined Invoice</a></li>
                                        <li><a class="dropdown-item py-2 d-flex align-items-center" href="#" onclick="InvoiceManager.downloadFromHistory(${originalIndex}, 'tax'); return false;"><i class="fas fa-file-invoice-dollar text-primary me-2 fs-6"></i> Tax Invoice</a></li>
                                        <li><a class="dropdown-item py-2 d-flex align-items-center" href="#" onclick="InvoiceManager.downloadFromHistory(${originalIndex}, 'challan'); return false;"><i class="fas fa-truck text-warning me-2 fs-6"></i> Delivery Challan</a></li>
                                        <li><a class="dropdown-item py-2 d-flex align-items-center" href="#" onclick="InvoiceManager.downloadFromHistory(${originalIndex}, 'quote'); return false;"><i class="fas fa-file-contract text-info me-2 fs-6"></i> Quotation</a></li>
                                    </ul>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" onclick="InvoiceManager.delete(${originalIndex})" title="Delete Invoice">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // Update Sort Icons
            const iconMap = {
                'savedAt': 'sort-icon-date',
                'details.invoiceNumber': 'sort-icon-inv',
                'details.clientName': 'sort-icon-client',
                'totals.total': 'sort-icon-amount'
            };

            Object.values(iconMap).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.className = 'fas fa-sort text-muted ms-1'; // Reset
            });

            const activeId = iconMap[this.sortField];
            if (activeId) {
                const el = document.getElementById(activeId);
                if (el) el.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'} text-primary ms-1`;
            }
        },

        delete(index) {
            NotificationManager.confirm(
                'Delete this saved invoice?',
                () => {
                    this.history.splice(index, 1);
                    this.saveHistory();
                    this.renderTable();
                },
                'Delete Invoice',
                'danger'
            );
        },

        async preview(index) {
            this.currentPreviewIndex = index;
            const select = document.getElementById('previewTypeSelect');
            if (select) select.value = 'tax'; // default
            if (this.previewModal) this.previewModal.show();
            await this._renderPreviewToIframe('tax', this.history[index]);
        },

        async changePreviewType() {
            if (this.currentPreviewIndex === null) return;
            const type = document.getElementById('previewTypeSelect').value;
            await this._renderPreviewToIframe(type, this.history[this.currentPreviewIndex]);
        },

        downloadPreview() {
            if (this.currentPreviewIndex === null) return;
            const type = document.getElementById('previewTypeSelect').value;
            this.downloadFromHistory(this.currentPreviewIndex, type);
        },

        async _renderPreviewToIframe(type, recordOriginal) {
            try {
                const loading = document.getElementById('previewLoading');
                const iframe = document.getElementById('previewIframe');
                if (loading) loading.classList.remove('d-none');
                if (iframe) iframe.style.display = 'none';

                let record = await ImageManager.processInvoiceForLoad(recordOriginal);

                const totals = record.totals;
                const data = {
                    details: { ...record.details },
                    items: JSON.parse(JSON.stringify(record.items)),
                    totals: totals,
                    numberInWords: numberToWords(totals.total),
                    numberInWordsSimple: numberToWords(totals.taxableValue)
                };

                let docDef;
                if (type === 'tax') {
                    docDef = generateTaxInvoice(data, true);
                } else if (type === 'simple') {
                    docDef = generateSimpleInvoice(data, true);
                } else if (type === 'combined') {
                    docDef = generateCombinedInvoice(data, true);
                } else if (type === 'challan') {
                    docDef = generateDeliveryChallan(data, true);
                } else if (type === 'quote') {
                    docDef = generateQuote(data, true);
                }

                if (docDef) {
                    const pdfDocGenerator = pdfMake.createPdf(docDef);
                    pdfDocGenerator.getDataUrl((dataUrl) => {
                        if (iframe) {
                            iframe.src = dataUrl;
                            iframe.style.display = 'block';
                        }
                        if (loading) loading.classList.add('d-none');
                    });
                } else {
                    if (loading) loading.classList.add('d-none');
                }
            } catch (error) {
                console.error('Preview Failed:', error);
                const loading = document.getElementById('previewLoading');
                if (loading) loading.classList.add('d-none');
                NotificationManager.alert('Failed to generate preview. ' + error.message, 'Preview Error', 'error');
            }
        },

        load(index) {
            NotificationManager.confirm(
                'Load this invoice? Unsaved changes will be lost.',
                () => {
                    this._executeLoad(index, false);
                },
                'Load Invoice',
                'warning'
            );
        },

        duplicate(index) {
            NotificationManager.confirm(
                'Load this invoice as a new document? Unsaved changes will be lost.',
                () => {
                    this._executeLoad(index, true);
                },
                'Duplicate Invoice',
                'info'
            );
        },

        async downloadFromHistory(index, type) {
            try {
                let record = this.history[index];

                // Resolve image references from DB/Supabase if any
                record = await ImageManager.processInvoiceForLoad(record);

                const totals = record.totals;
                const data = {
                    details: { ...record.details },
                    items: JSON.parse(JSON.stringify(record.items)),
                    totals: totals,
                    numberInWords: numberToWords(totals.total),
                    numberInWordsSimple: numberToWords(totals.taxableValue)
                };

                if (type === 'tax') {
                    generateTaxInvoice(data);
                } else if (type === 'simple') {
                    generateSimpleInvoice(data);
                } else if (type === 'combined') {
                    generateCombinedInvoice(data);
                } else if (type === 'challan') {
                    generateDeliveryChallan(data);
                } else if (type === 'quote') {
                    generateQuote(data);
                }
            } catch (error) {
                console.error('Download From History Failed:', error);
                NotificationManager.alert('Failed to generate PDF. ' + error.message, 'Download Error', 'error');
            }
        },

        async _executeLoad(index, isDuplicate = false) {

            let record = this.history[index];

            // Resolve images if they are references
            record = await ImageManager.processInvoiceForLoad(record);

            const s = record.settings;
            const d = record.details;

            // Restore Inputs
            if (isDuplicate) {
                // Generate fresh invoice number and use today's date
                document.getElementById('invoiceNumber').value = this.generateNextInvoiceNumber();
                document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
            } else {
                document.getElementById('invoiceNumber').value = d.invoiceNumber;
                document.getElementById('invoiceDate').value = d.date;
            }
            document.getElementById('invoiceNote').value = d.note || '';

            document.getElementById('companyName').value = s.companyName;
            document.getElementById('companyAddress').value = s.companyAddress;
            document.getElementById('companyGst').value = s.companyGst;
            document.getElementById('companyPhone').value = s.companyPhone;
            document.getElementById('companyEmail').value = s.companyEmail || '';

            document.getElementById('companyEmail').value = s.companyEmail || '';

            // Restore Images - Fix CORS by using stored Base64 if available
            if (s.logo && s.logo.startsWith('data:image')) {
                state.logoImage = s.logo;
                document.getElementById('logoUrl').value = s.logoUrl || ''; // Keep URL if it was there
                document.getElementById('logoPreview').src = s.logo;
                document.getElementById('logoPreview').style.display = 'block';
                document.getElementById('logoPlaceholder').style.display = 'none';
            } else {
                document.getElementById('logoUrl').value = s.logoUrl;
                document.getElementById('logoUrl').dispatchEvent(new Event('input'));
            }

            if (s.signature && s.signature.startsWith('data:image')) {
                state.signatureImage = s.signature;
                document.getElementById('signatureUrl').value = s.signatureUrl || '';
                if (s.signatureOption === 'draw') {
                    const canvas = document.getElementById('signatureCanvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = s.signature;
                } else {
                    document.getElementById('signatureUrlPreview').src = s.signature;
                    document.getElementById('signatureUrlPreview').style.display = 'block';
                    document.getElementById('signatureUrlPlaceholder').style.display = 'none';
                }
            } else {
                document.getElementById('signatureUrl').value = s.signatureUrl;
                document.getElementById('signatureUrl').dispatchEvent(new Event('input'));
            }

            document.getElementById('clientName').value = s.clientName;
            document.getElementById('clientAddress').value = s.clientAddress;
            document.getElementById('clientGst').value = s.clientGst;
            document.getElementById('clientPhone').value = s.clientPhone;
            document.getElementById('clientEmail').value = s.clientEmail || '';
            document.getElementById('clientNotes').value = s.clientNotes || '';
            document.getElementById('clientState').value = s.clientState;

            document.getElementById('transportMode').value = s.transportMode;
            document.getElementById('vehicleNumber').value = s.vehicleNumber;

            document.getElementById('bankName').value = s.bankName;
            document.getElementById('accountName').value = s.accountName || '';
            document.getElementById('accountNumber').value = s.accountNumber;
            document.getElementById('ifscCode').value = s.ifscCode;
            document.getElementById('upiId').value = s.upiId;

            // Restore Radio
            if (s.discountType === 'percent') document.getElementById('discPercent').checked = true;
            else document.getElementById('discFixed').checked = true;
            document.getElementById('discountValue').value = s.discountValue;

            // Restore State
            state.items = JSON.parse(JSON.stringify(record.items)); // Deep copy
            state.taxType = s.clientState === 'Same State' ? 'Same State' : 'Inter State';

            state.taxType = s.clientState === 'Same State' ? 'Same State' : 'Inter State';

            // Trigger Events
            // document.getElementById('logoUrl').dispatchEvent(new Event('input')); // Removed to prevent override by URL fetch
            // document.getElementById('signatureUrl').dispatchEvent(new Event('input')); // Removed
            document.getElementById('clientState').dispatchEvent(new Event('change'));

            // Render
            renderItems();
            calculateTotals();

            this.modal.hide();
        },

        exportHistoryToExcel() {
            if (this.history.length === 0) {
                NotificationManager.alert('No invoices to export.', 'Export Failed', 'warning');
                return;
            }

            const data = this.history.map(record => ({
                'Date Saved': record.savedAt,
                'Invoice Number': record.details.invoiceNumber || '',
                'Invoice Date': record.details.date || '',
                'Client Name': record.details.clientName || '',
                'Client GST': record.details.clientGst || '',
                'Taxable Amount': record.totals.taxableValue || 0,
                'CGST Amount': record.totals.cgst || 0,
                'SGST Amount': record.totals.sgst || 0,
                'IGST Amount': record.totals.igst || 0,
                'Total Amount': record.totals.total || 0
            }));

            if (typeof XLSX === 'undefined') {
                NotificationManager.alert('Excel export library is still loading. Please try again in a moment.', 'Library Not Loaded', 'warning');
                return;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Invoices");
            XLSX.writeFile(wb, "Invoice_History.xlsx");
        }
    };

    // Image Manager Implementation
    const ImageManager = {
        localCache: new Map(), // runtime cache: id -> base64
        hashCache: new Map(), // runtime cache: hash -> id
        init() {
            // Load cache from local storage if needed? 
            // For now, we'll just cache what we load in session to avoid too many DB calls.
            // Persisting this cache might be too heavy for localStorage if many images.
            // Let's rely on browser cache for URLs if we were using URLs, but we are using Base64.
            // So, maybe a small LRU cache or just rely on the fact that we look up by ID.
        },

        async hash(base64) {
            const msgBuffer = new TextEncoder().encode(base64);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        },

        async store(base64) {
            if (!base64 || !base64.startsWith('data:image')) return null;

            try {
                const hash = await this.hash(base64);

                if (this.hashCache.has(hash)) {
                    return `img_ref::${this.hashCache.get(hash)}`;
                }

                return base64; // Fallback without Supabase

            } catch (err) {
                console.error('Image Store Exception:', err);
                return base64; // Fallback
            }
        },

        async get(ref) {
            if (!ref || !ref.startsWith('img_ref::')) return ref;

            const id = ref.split('::')[1];

            // 1. Check Local Cache
            if (this.localCache.has(id)) {
                return this.localCache.get(id);
            }

            // Could not find image (Supabase removed)
            return null;
        },

        // Helper to process an object and replace base64 with refs recursively?
        // Or just specialized helpers for Invoice/Profile objects.
        // Let's do specialized to be safe.

        async processInvoiceForSave(invoiceData) {
            // Clone to avoid mutating original state immediately (though we might want to update state to match?)
            // Actually, we should probably keep state as Base64 for immediate UI, 
            // but save the Ref to the database/history.
            const copy = JSON.parse(JSON.stringify(invoiceData));

            // Process settings/details
            if (copy.details) {
                if (copy.details.logo && copy.details.logo.startsWith('data:image')) {
                    copy.details.logo = await this.store(copy.details.logo);
                }
                if (copy.details.signature && copy.details.signature.startsWith('data:image')) {
                    copy.details.signature = await this.store(copy.details.signature);
                }
            }

            // Note: If we had items with images, we'd process them here too.
            // Also settings in snapshot.settings might need processing if they duplicate details.
            if (copy.settings) {
                if (copy.settings.logo && copy.settings.logo.startsWith('data:image')) {
                    copy.settings.logo = await this.store(copy.settings.logo);
                }
                if (copy.settings.signature && copy.settings.signature.startsWith('data:image')) {
                    copy.settings.signature = await this.store(copy.settings.signature);
                }
            }

            return copy;
        },

        async processInvoiceForLoad(invoiceData) {
            // Clone
            const copy = JSON.parse(JSON.stringify(invoiceData));

            if (copy.details) {
                if (copy.details.logo && copy.details.logo.startsWith('img_ref::')) {
                    copy.details.logo = await this.get(copy.details.logo);
                }
                if (copy.details.signature && copy.details.signature.startsWith('img_ref::')) {
                    copy.details.signature = await this.get(copy.details.signature);
                }
            }
            if (copy.settings) {
                if (copy.settings.logo && copy.settings.logo.startsWith('img_ref::')) {
                    copy.settings.logo = await this.get(copy.settings.logo);
                }
                if (copy.settings.signature && copy.settings.signature.startsWith('img_ref::')) {
                    copy.settings.signature = await this.get(copy.settings.signature);
                }
            }
            return copy;
        }
    };
    window.ImageManager = ImageManager;



    // Data Manager Implementation
    const DataManager = {
        modal: null,

        init() {
            this.modal = new bootstrap.Modal(document.getElementById('viewDatabaseModal'));

            // Setup import file input handler
            const fileInput = document.getElementById('importFileInput');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileImport(e));
            }
        },

        async viewDatabase() {
            // Gather all relevant localforage data
            const data = {
                invoice_history: await this.getLocalForageItem('invoice_history'),
                invoice_profiles_company: await this.getLocalForageItem('invoice_profiles_company'),
                invoice_profiles_client: await this.getLocalForageItem('invoice_profiles_client'),
                invoice_profiles_payment: await this.getLocalForageItem('invoice_profiles_payment'),
                invoice_items_catalogue: await this.getLocalForageItem('invoice_items_catalogue')
            };

            // Format as pretty JSON
            const jsonStr = JSON.stringify(data, null, 2);
            document.getElementById('databaseJson').value = jsonStr;

            // Show modal
            this.modal.show();
        },

        async saveDatabase() {
            try {
                const jsonStr = document.getElementById('databaseJson').value;
                const data = JSON.parse(jsonStr);

                // Basic validation
                if (typeof data !== 'object' || data === null) {
                    throw new Error('Invalid JSON structure: Root must be an object.');
                }

                // Update Local Storage
                let updateCount = 0;
                const keys = ['invoice_history', 'invoice_profiles_company', 'invoice_profiles_client', 'invoice_profiles_payment', 'invoice_items_catalogue'];

                for (const key of keys) {
                    if (data.hasOwnProperty(key)) {
                        const val = data[key];
                        // If null, remove
                        if (val === null) await localforage.removeItem(key);
                        await StorageManager.setItem(key, val);
                        updateCount++;
                    }
                }

                // Reload Managers
                if (window.InvoiceManager && window.InvoiceManager.loadHistory) window.InvoiceManager.loadHistory();
                if (window.ProfileManager && window.ProfileManager.loadProfiles) window.ProfileManager.loadProfiles();
                if (window.ItemManager && window.ItemManager.loadItems) window.ItemManager.loadItems();

                NotificationManager.alert(`Database updated successfully! ${updateCount} keys processed.`, 'Success', 'success');
                this.modal.hide();

                // Generate new invoice number if needed (since history changed)
                if (window.InvoiceManager && window.InvoiceManager.setNextInvoiceNumber) {
                    window.InvoiceManager.setNextInvoiceNumber();
                }

            } catch (e) {
                console.error('Save Database Failed:', e);
                NotificationManager.alert(`Failed to save: ${e.message}`, 'Error', 'danger');
            }
        },

        async getLocalForageItem(key) {
            return await StorageManager.getItem(key);
        },

        async exportData() {
            // Gather all data
            const data = {
                exportDate: new Date().toISOString(),
                version: '1.0',
                data: {
                    invoice_history: await this.getLocalForageItem('invoice_history'),
                    invoice_profiles_company: await this.getLocalForageItem('invoice_profiles_company'),
                    invoice_profiles_client: await this.getLocalForageItem('invoice_profiles_client'),
                    invoice_profiles_payment: await this.getLocalForageItem('invoice_profiles_payment'),
                    invoice_items_catalogue: await this.getLocalForageItem('invoice_items_catalogue')
                }
            };

            // Create blob and download
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-data-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            NotificationManager.alert('Data exported successfully!');
        },

        importData() {
            NotificationManager.confirm(
                'Import data? This will OVERWRITE your current local data. Make sure you have a backup first!',
                () => {
                    // Trigger file input
                    document.getElementById('importFileInput').click();
                },
                'Warning',
                'danger'
            );
        },

        handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const imported = JSON.parse(e.target.result);

                    // Validate structure
                    if (!imported.data) {
                        throw new Error('Invalid data format');
                    }

                    // Import each key
                    const keys = ['invoice_history', 'invoice_profiles_company', 'invoice_profiles_client', 'invoice_profiles_payment', 'invoice_items_catalogue'];
                    let importCount = 0;

                    for (const key of keys) {
                        if (imported.data[key]) {
                            await StorageManager.setItem(key, imported.data[key]);
                            importCount++;
                        }
                    }

                    // Reload all managers
                    if (window.InvoiceManager && window.InvoiceManager.loadHistory) {
                        window.InvoiceManager.loadHistory();
                    }
                    if (window.ProfileManager && window.ProfileManager.loadProfiles) {
                        window.ProfileManager.loadProfiles();
                    }
                    if (window.ItemManager && window.ItemManager.loadItems) {
                        window.ItemManager.loadItems();
                        window.ItemManager.updateDatalist();
                    }

                    NotificationManager.alert(
                        `Data imported successfully! ${importCount} categories restored.\n\nExported on: ${imported.exportDate || 'Unknown'}\n\nPlease refresh the page to see all changes.`,
                        'Success'
                    );

                    // Optionally refresh the page
                    // Chained confirmation after alert (in a simpler flow, we might just put this in the alert callback or simpler separate confirm)
                    // Let's just ask directly
                    setTimeout(() => {
                        NotificationManager.confirm(
                            'Refresh the page now to apply all changes?',
                            () => location.reload(),
                            'Refresh Required',
                            'primary'
                        );
                    }, 1000);

                } catch (err) {
                    console.error('Import failed:', err);
                    NotificationManager.alert('Failed to import data. Please make sure the file is a valid backup file exported from this application.', 'Error');
                }

                // Reset file input
                event.target.value = '';
            };

            reader.readAsText(file);
        }
    };

    // Error Logger Implementation
    const ErrorLogger = {
        logs: [], // Initialize immediately
        modal: null,

        async init() {
            const modalEl = document.getElementById('viewLogsModal');
            if (modalEl) this.modal = new bootstrap.Modal(modalEl);
            await this.load();
            this.setupListeners();
            this.captureConsoleErrors();
        },

        setupListeners() {
            window.onerror = (message, source, lineno, colno, error) => {
                this.log({
                    type: 'Global Error',
                    message,
                    source: `${source}:${lineno}:${colno}`,
                    stack: error ? error.stack : 'No stack trace'
                });
            };

            window.onunhandledrejection = (event) => {
                this.log({
                    type: 'Unhandled Rejection',
                    message: event.reason ? (event.reason.message || String(event.reason)) : 'Unknown reason',
                    stack: event.reason && event.reason.stack ? event.reason.stack : null
                });
            };
        },

        captureConsoleErrors() {
            const originalConsoleError = console.error;
            const originalConsoleLog = console.log;

            console.error = (...args) => {
                const message = args.map(arg => {
                    if (arg instanceof Error) return arg.message;
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch (e) {
                            return String(arg);
                        }
                    }
                    return String(arg);
                }).join(' ');

                this.log({
                    type: 'Console Error',
                    message: message,
                    stack: new Error().stack
                });

                originalConsoleError.apply(console, args);
            };

            console.log = (...args) => {
                const message = args.map(arg => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch (e) {
                            return String(arg);
                        }
                    }
                    return String(arg);
                }).join(' ');

                this.log({
                    type: 'Console Log',
                    message: message
                });

                originalConsoleLog.apply(console, args);
            };
        },

        isLogging: false,
        async log(detail) {
            if (this.isLogging) return;
            this.isLogging = true;
            try {
                const entry = {
                    timestamp: new Date().toISOString(),
                    ...detail
                };
                if (!Array.isArray(this.logs)) this.logs = [];
                this.logs.unshift(entry);
                if (this.logs.length > 200) this.logs.pop(); // Increased limit
                await this.save();
            } finally {
                this.isLogging = false;
            }
        },

        async load() {
            try {
                const data = await localforage.getItem('error_log');
                this.logs = Array.isArray(data) ? data : [];
            } catch (e) {
                console.error('Failed to load logs:', e);
                this.logs = [];
            }
        },

        async save() {
            try {
                await localforage.setItem('error_log', this.logs);
            } catch (e) {
                console.error('Failed to save logs:', e);
            }
        },

        open() {
            this.load();
            const content = document.getElementById('logsContent');
            if (!content) return;

            if (this.logs.length === 0) {
                content.textContent = 'No logs found.';
            } else {
                content.textContent = this.logs.map(log => {
                    return `[${log.timestamp}] ${log.type}: ${log.message}\n` +
                        (log.source ? `Source: ${log.source}:${log.line}:${log.col}\n` : '') +
                        (log.stack ? `Stack: ${log.stack}\n` : '') +
                        '--------------------------------------------';
                }).join('\n\n');
            }
            if (this.modal) this.modal.show();
        },

        download() {
            if (this.logs.length === 0) {
                NotificationManager.alert('No logs to download.');
                return;
            }
            const text = this.logs.map(log => JSON.stringify(log, null, 2)).join('\n\n---\n\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-error-log-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        clear() {
            NotificationManager.confirm(
                'Are you sure you want to clear all error logs?',
                async () => {
                    this.logs = [];
                    await this.save();
                    this.open(); // Refresh view
                },
                'Clear Logs',
                'danger'
            );
        }
    };



    // ============================================
    // DARK MODE TOGGLE IMPLEMENTATION
    // ============================================
    const DarkModeManager = {
        body: document.querySelector('body'),
        btn: document.getElementById('themeToggleBtn'),
        icon: document.querySelector('.theme-toggle-btn__icon'),
        storageKey: 'invoiceGeneratorDarkMode',

        async init() {
            if (!this.btn || !this.icon) {
                console.warn('Dark mode toggle elements not found');
                return;
            }

            // Load saved preference
            await this.load();

            // Add click event listener
            this.btn.addEventListener('click', () => this.toggle());
        },

        async store(value) {
            await StorageManager.setItem(this.storageKey, value);
        },

        async load() {
            const darkmode = await StorageManager.getItem(this.storageKey);

            if (!darkmode) {
                // First time - default to light mode
                await this.store('false');
                this.icon.classList.add('fa-sun');
            } else if (darkmode === 'true' || darkmode === true) {
                // Dark mode is enabled
                this.body.classList.add('darkmode');
                this.icon.classList.add('fa-moon');
            } else {
                // Light mode
                this.icon.classList.add('fa-sun');
            }
        },

        async toggle() {
            // Toggle dark mode class
            this.body.classList.toggle('darkmode');

            // Add animation
            this.icon.classList.add('animated');

            // Save state
            await this.store(this.body.classList.contains('darkmode') ? 'true' : 'false');

            // Update icon
            if (this.body.classList.contains('darkmode')) {
                this.icon.classList.remove('fa-sun');
                this.icon.classList.add('fa-moon');
            } else {
                this.icon.classList.remove('fa-moon');
                this.icon.classList.add('fa-sun');
            }

            // Remove animation after it completes
            setTimeout(() => {
                this.icon.classList.remove('animated');
            }, 500);
        }
    };



    // Notification Manager Implementation
    const NotificationManager = {
        alertModal: null,
        confirmModal: null,
        onConfirm: null,

        init() {
            const alertEl = document.getElementById('genericAlertModal');
            if (alertEl) this.alertModal = new bootstrap.Modal(alertEl);

            const confirmEl = document.getElementById('genericConfirmModal');
            if (confirmEl) this.confirmModal = new bootstrap.Modal(confirmEl);

            // Bind Yes Button for Confirm
            const yesBtn = document.getElementById('genericConfirmYesBtn');
            if (yesBtn) {
                yesBtn.addEventListener('click', () => {
                    if (this.onConfirm && typeof this.onConfirm === 'function') {
                        this.onConfirm();
                    }
                    if (this.confirmModal) this.confirmModal.hide();
                });
            }
        },

        alert(message, title = 'Notification', type = 'primary') {
            const titleEl = document.getElementById('genericAlertTitle');
            const msgEl = document.getElementById('genericAlertMessage');
            const headerEl = document.getElementById('genericAlertHeader');

            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;

            // Reset classes
            if (headerEl) {
                headerEl.className = `modal-header text-white bg-${type === 'error' ? 'danger' : (type === 'success' ? 'success' : 'primary')}`;
            }

            if (this.alertModal) this.alertModal.show();
            else window.alert(message); // Fallback
        },

        confirm(message, callback, title = 'Confirm', type = 'danger') {
            const titleEl = document.getElementById('genericConfirmTitle');
            const msgEl = document.getElementById('genericConfirmMessage');
            const headerEl = document.getElementById('genericConfirmHeader');
            const yesBtn = document.getElementById('genericConfirmYesBtn');

            if (titleEl) titleEl.textContent = title;
            if (msgEl) msgEl.textContent = message;

            // Theme
            if (headerEl) {
                headerEl.className = `modal-header text-white bg-${type}`;
            }
            if (yesBtn) {
                yesBtn.className = `btn btn-${type}`;
            }

            this.onConfirm = callback;

            if (this.confirmModal) this.confirmModal.show();
            else if (window.confirm(message)) callback(); // Fallback
        }
    };

    // Modal Dragger Implementation
    const ModalDragger = {
        init() {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                const header = modal.querySelector('.modal-header');
                const dialog = modal.querySelector('.modal-dialog');
                if (header && dialog) {
                    this.makeDraggable(modal, header, dialog);
                }
            });
        },

        makeDraggable(modal, header, dialog) {
            header.style.cursor = 'move';

            let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

            const dragMouseDown = (e) => {
                // Ignore dragging if clicking on an interactive element
                if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName) || e.target.closest('button') || e.target.closest('a')) return;

                e.preventDefault();
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = parseFloat(dialog.style.left) || 0;
                initialTop = parseFloat(dialog.style.top) || 0;

                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            };

            const elementDrag = (e) => {
                e.preventDefault();
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                dialog.style.position = 'relative';
                dialog.style.left = (initialLeft + deltaX) + "px";
                dialog.style.top = (initialTop + deltaY) + "px";
            };

            const closeDragElement = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };

            header.onmousedown = dragMouseDown;

            modal.addEventListener('hidden.bs.modal', () => {
                dialog.style.top = '';
                dialog.style.left = '';
            });
        }
    };

    // Initialize all components in an async IIFE
    (async () => {
        // Migration from localStorage to localForage
        try {
            const keysToMigrate = [
                'invoice_history', 'invoice_profiles_company', 'invoice_profiles_client', 
                'invoice_profiles_payment', 'invoice_items_catalogue', 'error_log', 'invoiceGeneratorDarkMode'
            ];
            let migratedAny = false;
            for (const key of keysToMigrate) {
                const val = localStorage.getItem(key);
                if (val !== null) {
                    try {
                        const toStore = (key === 'invoiceGeneratorDarkMode') ? val : JSON.parse(val);
                        await localforage.setItem(key, toStore);
                        localStorage.removeItem(key);
                        localStorage.removeItem(`${key}_meta`); // Cleanup meta too
                        migratedAny = true;
                    } catch (e) {
                        console.error('Migration failed for key', key, e);
                    }
                }
            }
            if (migratedAny) {
                console.log('Migrated data from localStorage to localForage');
            }
        } catch(e) {
            console.error('Global migration error', e);
        }

        // Init managers
        NotificationManager.init();
        window.NotificationManager = NotificationManager;
        
        ModalDragger.init();
        
        SupabaseManager.init();
        window.SupabaseManager = SupabaseManager;
        
        await ErrorLogger.init();
        window.ErrorLogger = ErrorLogger;
        
        DataManager.init();
        window.DataManager = DataManager;
        
        await DarkModeManager.init();
        window.DarkModeManager = DarkModeManager;
        
        await InvoiceManager.init();
        window.InvoiceManager = InvoiceManager;
        
        // Load Defaults
        setTimeout(async () => {
            await ProfileManager.loadDefaults();
        }, 1000);
    })();

    // Back to Top Logic
    const backToTopBtn = document.getElementById('backToTopBtn');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.altKey) {
            switch(e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    if (window.InvoiceManager && window.InvoiceManager.saveCurrent) {
                        window.InvoiceManager.saveCurrent();
                    }
                    break;
                case 'p':
                    e.preventDefault();
                    const btnSimple = document.getElementById('btnSimpleInvoice');
                    if (btnSimple) btnSimple.click();
                    break;
                case 'n':
                    e.preventDefault();
                    const resetBtn = document.getElementById('resetBtn');
                    if (resetBtn) resetBtn.click();
                    break;
                case 'h':
                    e.preventDefault();
                    if (window.InvoiceManager && window.InvoiceManager.modal) {
                        window.InvoiceManager.modal.show();
                    }
                    break;
            }
        }
    });

});

