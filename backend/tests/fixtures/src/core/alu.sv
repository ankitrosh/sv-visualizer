module alu (
    input  logic clk,
    input  logic [31:0] a,
    input  logic [31:0] b,
    output logic [31:0] result
);
    always_comb begin
        result = a + b;
    end
endmodule
