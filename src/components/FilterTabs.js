const FilterTabs = ({ options, activeOption, onChange, style = {} }) => {
  return (
    <div className="chip-group" style={{ marginBottom: '20px', ...style }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`chip${activeOption === option.value ? ' chip--active' : ''}`}
          aria-pressed={activeOption === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default FilterTabs;
