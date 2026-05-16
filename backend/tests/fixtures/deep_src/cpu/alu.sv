module alu (
    input  logic clk,
    input  logic [15:0] a,
    input  logic [15:0] b,
    input  logic [4:0]  op,
    output logic [31:0] result
);
    always_comb begin
        result = a + b;
    end
endmodule
