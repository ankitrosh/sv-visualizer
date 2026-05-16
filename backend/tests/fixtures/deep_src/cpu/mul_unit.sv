module mul_unit (
    input  logic clk,
    input  logic [15:0] a,
    input  logic [15:0] b,
    output logic [31:0] result
);
    assign result = a * b;
endmodule
