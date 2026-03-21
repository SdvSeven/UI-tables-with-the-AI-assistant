import React from 'react';
import DataTable from './components/DataTable';

function App() {
    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#f8f9fa',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <DataTable />
        </div>
    );
}

export default App;