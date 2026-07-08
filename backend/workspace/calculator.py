# calculator.py

def add(x, y):
    return x + y

def subtract(x, y):
    return x - y

def multiply(x, y):
    return x * y

def divide(x, y):
    if y == 0:
        raise ValueError("Cannot divide by zero!")
    return x / y

def main():
    print("Simple Python Calculator")
    print("Available operations: +, -, *, /")

    while True:
        try:
            num1 = float(input("Enter first number: "))
            operation = input("Enter operation (+, -, *, /) or 'q' to quit: ")

            if operation == 'q':
                print("Exiting calculator. Goodbye!")
                break
            
            if operation not in ['+', '-', '*', '/']:
                print("Invalid operation. Please try again.")
                continue

            num2 = float(input("Enter second number: "))

            result = None
            if operation == '+':
                result = add(num1, num2)
            elif operation == '-':
                result = subtract(num1, num2)
            elif operation == '*':
                result = multiply(num1, num2)
            elif operation == '/':
                result = divide(num1, num2)
            
            print(f"Result: {num1} {operation} {num2} = {result}")

        except ValueError as e:
            print(f"Error: {e}. Please enter valid numbers.")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
