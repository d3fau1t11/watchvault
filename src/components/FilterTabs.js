const FilterTabs = ({ options, activeOption, onChange, style = {} }) => {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', ...style }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: '8px 18px',
            borderRadius: '20px',
            border: 'none',
            background: activeOption === option.value ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: activeOption === option.value ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default FilterTabs;
