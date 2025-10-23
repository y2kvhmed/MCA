import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from './Input';
import Button from './Button';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

interface Formula {
  name: string;
  formula: string;
  variables: { [key: string]: string };
  calculate: (values: { [key: string]: number }) => number;
  unit: string;
}

const physicsFormulas: Formula[] = [
  {
    name: 'Velocity',
    formula: 'v = d / t',
    variables: { d: 'Distance (m)', t: 'Time (s)' },
    calculate: (values) => values.d / values.t,
    unit: 'm/s',
  },
  {
    name: 'Acceleration',
    formula: 'a = (v₂ - v₁) / t',
    variables: { v2: 'Final Velocity (m/s)', v1: 'Initial Velocity (m/s)', t: 'Time (s)' },
    calculate: (values) => (values.v2 - values.v1) / values.t,
    unit: 'm/s²',
  },
  {
    name: 'Force',
    formula: 'F = m × a',
    variables: { m: 'Mass (kg)', a: 'Acceleration (m/s²)' },
    calculate: (values) => values.m * values.a,
    unit: 'N',
  },
  {
    name: 'Kinetic Energy',
    formula: 'KE = ½mv²',
    variables: { m: 'Mass (kg)', v: 'Velocity (m/s)' },
    calculate: (values) => 0.5 * values.m * Math.pow(values.v, 2),
    unit: 'J',
  },
  {
    name: 'Potential Energy',
    formula: 'PE = mgh',
    variables: { m: 'Mass (kg)', g: 'Gravity (9.8 m/s²)', h: 'Height (m)' },
    calculate: (values) => values.m * (values.g || 9.8) * values.h,
    unit: 'J',
  },
  {
    name: 'Power',
    formula: 'P = W / t',
    variables: { W: 'Work (J)', t: 'Time (s)' },
    calculate: (values) => values.W / values.t,
    unit: 'W',
  },
  {
    name: 'Ohm\'s Law (Voltage)',
    formula: 'V = I × R',
    variables: { I: 'Current (A)', R: 'Resistance (Ω)' },
    calculate: (values) => values.I * values.R,
    unit: 'V',
  },
  {
    name: 'Ohm\'s Law (Current)',
    formula: 'I = V / R',
    variables: { V: 'Voltage (V)', R: 'Resistance (Ω)' },
    calculate: (values) => values.V / values.R,
    unit: 'A',
  },
  {
    name: 'Wave Speed',
    formula: 'v = f × λ',
    variables: { f: 'Frequency (Hz)', λ: 'Wavelength (m)' },
    calculate: (values) => values.f * values.λ,
    unit: 'm/s',
  },
  {
    name: 'Momentum',
    formula: 'p = m × v',
    variables: { m: 'Mass (kg)', v: 'Velocity (m/s)' },
    calculate: (values) => values.m * values.v,
    unit: 'kg⋅m/s',
  },
];

export default function PhysicsCalculator() {
  const [selectedFormula, setSelectedFormula] = useState<Formula>(physicsFormulas[0]);
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const handleInputChange = (variable: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [variable]: value
    }));
    setResult(null); // Clear result when inputs change
  };

  const calculateResult = () => {
    try {
      const numericValues: { [key: string]: number } = {};
      let allInputsValid = true;

      // Convert string inputs to numbers
      Object.keys(selectedFormula.variables).forEach(variable => {
        const value = parseFloat(inputValues[variable] || '0');
        if (isNaN(value)) {
          allInputsValid = false;
          return;
        }
        numericValues[variable] = value;
      });

      if (!allInputsValid) {
        setResult(null);
        return;
      }

      const calculatedResult = selectedFormula.calculate(numericValues);
      setResult(calculatedResult);
      setShowSteps(true);
    } catch (error) {
      console.error('Calculation error:', error);
      setResult(null);
    }
  };

  const clearInputs = () => {
    setInputValues({});
    setResult(null);
    setShowSteps(false);
  };

  const renderCalculationSteps = () => {
    if (!result || !showSteps) return null;

    const steps = [];
    steps.push(`Formula: ${selectedFormula.formula}`);
    
    // Show substitution
    let substitution = selectedFormula.formula;
    Object.keys(selectedFormula.variables).forEach(variable => {
      const value = inputValues[variable] || '0';
      substitution = substitution.replace(new RegExp(variable, 'g'), value);
    });
    steps.push(`Substitution: ${substitution}`);
    
    steps.push(`Result: ${result.toFixed(3)} ${selectedFormula.unit}`);

    return (
      <View style={styles.stepsContainer}>
        <Text style={styles.stepsTitle}>Calculation Steps:</Text>
        {steps.map((step, index) => (
          <Text key={index} style={styles.stepText}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Physics Calculator</Text>
      
      {/* Formula Selection */}
      <View style={styles.formulaSelector}>
        <Text style={styles.sectionTitle}>Select Formula:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {physicsFormulas.map((formula, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.formulaButton,
                selectedFormula.name === formula.name && styles.formulaButtonSelected
              ]}
              onPress={() => {
                setSelectedFormula(formula);
                clearInputs();
              }}
            >
              <Text style={[
                styles.formulaButtonText,
                selectedFormula.name === formula.name && styles.formulaButtonTextSelected
              ]}>
                {formula.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Selected Formula Display */}
      <View style={styles.formulaDisplay}>
        <Text style={styles.formulaName}>{selectedFormula.name}</Text>
        <Text style={styles.formulaText}>{selectedFormula.formula}</Text>
      </View>

      {/* Input Fields */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>Enter Values:</Text>
        {Object.entries(selectedFormula.variables).map(([variable, description]) => (
          <Input
            key={variable}
            label={description}
            value={inputValues[variable] || ''}
            onChangeText={(value) => handleInputChange(variable, value)}
            placeholder="0"
            keyboardType="numeric"
          />
        ))}
      </View>

      {/* Calculate Button */}
      <View style={styles.buttonSection}>
        <Button
          title="Calculate"
          onPress={calculateResult}
          style={styles.calculateButton}
        />
        <Button
          title="Clear"
          onPress={clearInputs}
          style={styles.clearButton}
          variant="outline"
        />
      </View>

      {/* Result Display */}
      {result !== null && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Result:</Text>
          <Text style={styles.resultValue}>
            {result.toFixed(3)} {selectedFormula.unit}
          </Text>
        </View>
      )}

      {/* Calculation Steps */}
      {renderCalculationSteps()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  formulaSelector: {
    marginBottom: Spacing.xl,
  },
  formulaButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    backgroundColor: Colors.card.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  formulaButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  formulaButtonText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  formulaButtonTextSelected: {
    color: Colors.text.inverse,
  },
  formulaDisplay: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  formulaName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  formulaText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
  },
  inputSection: {
    marginBottom: Spacing.xl,
  },
  buttonSection: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  calculateButton: {
    flex: 1,
  },
  clearButton: {
    flex: 1,
  },
  resultContainer: {
    backgroundColor: Colors.success + '20',
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  resultLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  resultValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.success,
  },
  stepsContainer: {
    backgroundColor: Colors.card.background,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  stepText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    fontFamily: 'monospace',
  },
});