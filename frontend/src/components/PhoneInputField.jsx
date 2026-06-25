import PhoneInput from 'react-phone-number-input';
import es from 'react-phone-number-input/locale/es.json';
import 'react-phone-number-input/style.css';
import '../styles/phone-input.css';

export default function PhoneInputField({ value, onChange, defaultCountry = 'UY', ...rest }) {
  return (
    <PhoneInput
      international
      defaultCountry={defaultCountry}
      labels={es}
      value={value}
      onChange={onChange}
      className="form-control phone-input-field"
      numberInputProps={{ className: 'phone-input-field__number' }}
      {...rest}
    />
  );
}
