const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addManualPayment: async (payload) => {
    try {
      // Validate required fields before sending
      if (!payload.TraderID || !payload.Amount) {
        throw new Error('TraderID and Amount are required');
      }
      return await ipcRenderer.invoke('addManualPayment', payload);
    } catch (error) {
      console.error('Payment error:', error);
      return { success: false, error: error.message };
    }
  },
  // ... other exposed methods
});

});
