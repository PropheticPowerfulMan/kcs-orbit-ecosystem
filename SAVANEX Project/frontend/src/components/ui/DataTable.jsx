import React from 'react';

const DataTable = ({ columns, data }) => {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/55 text-slate-300">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={row.id || index} className="border-t border-github-border hover:bg-slate-800/35">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-200">
                  {typeof col.render === 'function' ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
