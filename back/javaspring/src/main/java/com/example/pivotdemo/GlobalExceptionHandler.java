package com.example.pivotdemo;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String message = String.format(
            "Invalid parameter '%s' with value '%s'. Expected type: %s",
            ex.getName(),
            ex.getValue(),
            ex.getRequiredType().getSimpleName()
        );
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }
}