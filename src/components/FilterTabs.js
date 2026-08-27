const FilterTabs = ({ options, activeOption, onChange, className = "" }) => {
  return (
    <div className={`chip-group${className ? ` ${className}` : ""}`}>
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
